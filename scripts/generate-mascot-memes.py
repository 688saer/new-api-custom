import json
import urllib.request
import base64
import time
import os

OUT = '/root/memes2'
os.makedirs(OUT, exist_ok=True)

BASE = (
    'cute chibi blue whale girl mascot, big sparkly eyes, light blue hair, '
    'small whale tail and tiny fins, white and blue maid outfit, anime sticker, '
    'thick clean outlines, vibrant flat colors, plain white background, '
    'centered full body, '
)

MOODS = {
    'hi': 'waving hello cheerfully with a warm friendly smile',
    'happy': 'jumping joyfully with both arms raised and a huge happy smile, sparkles',
    'think': 'finger on chin thinking, small spiral above head, curious eyes',
    'sleepy': 'sleeping peacefully while hugging a small whale plush, floating Zzz',
    'cheer': 'cheering with both fists up, star eyes, confetti',
    'sorry': 'bowing apologetically with a sheepish sweat drop, hands together',
    'proud': 'standing proudly with hands on hips, confident smug grin, sparkle',
    'cry': 'crying comically with big tear streams, wobbling mouth',
    'wink': 'winking and making a peace sign, playful grin',
    'wave': 'holding a tiny blank sign board with both hands, neutral helpful smile',
    'love': 'hands clasped with heart eyes and floating hearts',
    'shock': 'shocked with wide eyes and open mouth, exclamation mark above head',
}


def generate(name, mood, attempts=3):
    prompt = BASE + mood
    body = json.dumps(
        {'model': 'gpt-image-2', 'prompt': prompt, 'n': 1, 'size': '1024x1024'}
    ).encode()
    token = open('/root/.imgtok').read().strip()
    for attempt in range(1, attempts + 1):
        target = os.path.join(OUT, name + '.png')
        if os.path.exists(target) and os.path.getsize(target) > 100000:
            print('  %s: cached' % name, flush=True)
            return True
        try:
            req = urllib.request.Request(
                'http://127.0.0.1:3000/v1/images/generations',
                data=body,
                headers={
                    'Authorization': 'Bearer sk-' + token,
                    'Content-Type': 'application/json',
                },
            )
            data = json.load(urllib.request.urlopen(req, timeout=240))
            item = data['data'][0]
            if item.get('b64_json'):
                open(target, 'wb').write(base64.b64decode(item['b64_json']))
            else:
                urllib.request.urlretrieve(item['url'], target)
            print('  %s: ok (attempt %d)' % (name, attempt), flush=True)
            return True
        except Exception as exc:
            print('  %s attempt %d: %s' % (name, attempt, exc), flush=True)
            time.sleep(6)
    return False


ok = 0
for index, (mood_name, mood_desc) in enumerate(MOODS.items(), 1):
    if generate(mood_name, mood_desc):
        ok += 1
    print('progress %d/%d' % (index, len(MOODS)), flush=True)

print('done: %d/%d' % (ok, len(MOODS)))
