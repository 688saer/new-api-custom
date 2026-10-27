package model

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 工单图片附件
// ---------------------------------------------------------------------------

// 单张图片上限 2MB，与前端提示保持一致
const ticketAttachmentMaxBytes = 2 * 1024 * 1024

// 上传者类型：站点用户与后台客服是两套账号，id 各自独立编号，
// 必须分开记录，否则 user#1 能读到 agent#1 上传的图。
const (
	TicketUploaderUser  = "user"
	TicketUploaderAgent = "agent"
)

// 允许的图片类型，用内容嗅探判断而不是相信扩展名
var ticketAttachmentMimeTypes = map[string]string{
	"image/png":  ".png",
	"image/jpeg": ".jpg",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

// ticketAttachmentDir 图片落盘目录，可用 TICKET_ATTACHMENT_DIR 覆盖
func ticketAttachmentDir() string {
	dir := strings.TrimSpace(os.Getenv("TICKET_ATTACHMENT_DIR"))
	if dir == "" {
		dir = filepath.Join(".", "data", "ticket-attachments")
	}
	return dir
}

// StoreTicketAttachment 保存一张上传的图片，返回未绑定的附件记录。
// 此时 TicketId 为 0，创建工单或发消息时再绑定到具体消息上。
func StoreTicketAttachment(uploaderType string, uploaderId int, fileName string, data []byte) (*TicketAttachment, error) {
	if len(data) == 0 {
		return nil, newTicketError(TicketCodeAttachmentMissing, "The image file is empty")
	}
	if len(data) > ticketAttachmentMaxBytes {
		return nil, newTicketError(TicketCodeAttachmentTooLarge, "Each image must be smaller than 2 MB")
	}

	mimeType := http.DetectContentType(data)
	extension, ok := ticketAttachmentMimeTypes[mimeType]
	if !ok {
		return nil, newTicketError(TicketCodeAttachmentInvalidType, "Only PNG, JPG, GIF and WebP images are supported")
	}

	now := time.Now()
	relative := filepath.Join(now.Format("2006"), now.Format("01"), uuid.NewString()+extension)
	fullPath := filepath.Join(ticketAttachmentDir(), relative)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o750); err != nil {
		return nil, fmt.Errorf("create attachment directory: %w", err)
	}
	if err := os.WriteFile(fullPath, data, 0o600); err != nil {
		return nil, fmt.Errorf("write attachment: %w", err)
	}

	attachment := &TicketAttachment{
		UploaderType: uploaderType,
		UploaderId:   uploaderId,
		FileName:     sanitizeAttachmentName(fileName, extension),
		MimeType:     mimeType,
		Size:         int64(len(data)),
		StorageKey:   relative,
		CreatedAt:    common.GetTimestamp(),
	}
	if err := DB.Create(attachment).Error; err != nil {
		_ = os.Remove(fullPath)
		return nil, err
	}
	return attachment, nil
}

func sanitizeAttachmentName(fileName, extension string) string {
	name := strings.TrimSpace(filepath.Base(fileName))
	if name == "" || name == "." || name == string(filepath.Separator) {
		return "image" + extension
	}
	runes := []rune(name)
	if len(runes) > 100 {
		name = string(runes[:100])
	}
	return name
}

// attachUploadedImages 把预上传的图片绑定到消息上。
// 只接受同一上传者上传、且尚未绑定到任何工单的记录。
func attachUploadedImages(tx *gorm.DB, ticketId, messageId int, uploaderType string, uploaderId int, keys []string) error {
	if len(keys) == 0 {
		return nil
	}

	ids := make([]int, 0, len(keys))
	for _, key := range keys {
		var id int
		if _, err := fmt.Sscanf(strings.TrimSpace(key), "%d", &id); err != nil || id <= 0 {
			return newTicketError(TicketCodeAttachmentMissing, "The image is no longer available, please upload it again")
		}
		ids = append(ids, id)
	}

	var attachments []TicketAttachment
	err := tx.Where("id IN ? AND uploader_type = ? AND uploader_id = ? AND ticket_id = 0",
		ids, uploaderType, uploaderId).Find(&attachments).Error
	if err != nil {
		return err
	}
	if len(attachments) != len(ids) {
		return newTicketError(TicketCodeAttachmentMissing, "The image is no longer available, please upload it again")
	}

	return tx.Model(&TicketAttachment{}).Where("id IN ?", ids).Updates(map[string]any{
		"ticket_id":  ticketId,
		"message_id": messageId,
	}).Error
}

// OpenTicketAttachment 打开附件文件，调用方负责关闭
func OpenTicketAttachment(attachment *TicketAttachment) (*os.File, error) {
	fullPath := filepath.Join(ticketAttachmentDir(), attachment.StorageKey)
	file, err := os.Open(fullPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil, newTicketError(TicketCodeAttachmentMissing, "This image is no longer available")
	}
	if err != nil {
		return nil, err
	}
	return file, nil
}

// FindTicketAttachmentForUser 用户读取自己工单里的图片。
// 尚未绑定工单的（刚上传的）只要上传者本人即可读。
func FindTicketAttachmentForUser(userId, attachmentId int) (*TicketAttachment, error) {
	var attachment TicketAttachment
	err := DB.Where("id = ?", attachmentId).First(&attachment).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, newTicketError(TicketCodeAttachmentMissing, "This image is no longer available")
	}
	if err != nil {
		return nil, err
	}
	if attachment.UploaderType == TicketUploaderUser && attachment.UploaderId == userId {
		return &attachment, nil
	}
	if attachment.TicketId > 0 {
		var count int64
		err := DB.Model(&Ticket{}).
			Where("id = ? AND user_id = ?", attachment.TicketId, userId).
			Count(&count).Error
		if err != nil {
			return nil, err
		}
		if count > 0 {
			return &attachment, nil
		}
	}
	return nil, newTicketError(TicketCodeAttachmentMissing, "This image is no longer available")
}

// FindTicketAttachmentByAgent 后台读取任意工单图片，可见范围由工单决定
func FindTicketAttachmentByAgent(agent *TicketAgent, attachmentId int) (*TicketAttachment, error) {
	var attachment TicketAttachment
	err := DB.Where("id = ?", attachmentId).First(&attachment).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, newTicketError(TicketCodeAttachmentMissing, "This image is no longer available")
	}
	if err != nil {
		return nil, err
	}
	if attachment.TicketId > 0 {
		if _, err := findStaffTicket(agent, attachment.TicketId); err != nil {
			return nil, err
		}
		return &attachment, nil
	}
	if attachment.UploaderType == TicketUploaderAgent && attachment.UploaderId == agent.Id && agent.Id > 0 {
		return &attachment, nil
	}
	return nil, newTicketError(TicketCodeAttachmentMissing, "This image is no longer available")
}

// CopyTicketAttachment 把图片写到响应体，统一设置安全响应头
func CopyTicketAttachment(writer io.Writer, attachment *TicketAttachment) error {
	file, err := OpenTicketAttachment(attachment)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = io.Copy(writer, file)
	return err
}

// TicketAttachmentMimeType 附件 MIME，缺省回落二进制流
func TicketAttachmentMimeType(attachment *TicketAttachment) string {
	if attachment.MimeType == "" {
		return "application/octet-stream"
	}
	return attachment.MimeType
}
