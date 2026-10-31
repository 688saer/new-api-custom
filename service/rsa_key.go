package service

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"strings"
)

// 支付宝和微信支付都用 RSA 密钥，只是 PEM 头的类型不同，这里放一份通用解析。

func parseRSAPrivateKey(raw string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(normalizePEMKey(raw, "PRIVATE KEY")))
	if block == nil {
		return nil, errors.New("private key is not readable")
	}
	if parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		key, ok := parsed.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("private key is not RSA")
		}
		return key, nil
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	return nil, errors.New("private key is not readable")
}

func parseRSAPublicKey(raw string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(normalizePEMKey(raw, "PUBLIC KEY")))
	if block == nil {
		return nil, errors.New("public key is not readable")
	}
	if parsed, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
		key, ok := parsed.(*rsa.PublicKey)
		if !ok {
			return nil, errors.New("public key is not RSA")
		}
		return key, nil
	}
	if key, err := x509.ParsePKCS1PublicKey(block.Bytes); err == nil {
		return key, nil
	}
	return nil, errors.New("public key is not readable")
}

// normalizePEMKey 让控制台里复制出来的密钥能被解析：可能自带 PEM 头，
// 也可能是裸 base64（常常还带着换行和空格）。
func normalizePEMKey(raw string, blockType string) string {
	trimmed := strings.TrimSpace(raw)
	if strings.Contains(trimmed, "-----BEGIN") {
		return trimmed
	}
	body := strings.NewReplacer("\r", "", "\n", "", "\t", "", " ", "").Replace(trimmed)
	if body == "" {
		return ""
	}

	var builder strings.Builder
	builder.WriteString("-----BEGIN " + blockType + "-----\n")
	for len(body) > 64 {
		builder.WriteString(body[:64])
		builder.WriteByte('\n')
		body = body[64:]
	}
	builder.WriteString(body)
	builder.WriteString("\n-----END " + blockType + "-----\n")
	return builder.String()
}
