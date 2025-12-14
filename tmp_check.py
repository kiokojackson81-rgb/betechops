from pathlib import Path
path = Path('src/app/receipts/ReceiptsAdminClient.tsx')
text = path.read_text()
for i, ch in enumerate(text):
    if ord(ch) == 0:
        print('null at', i)
        break
else:
    print('no null char')
