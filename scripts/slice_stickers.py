import os
from PIL import Image

CATS = ['opus', 'codex', 'gemini']
EXPRESSIONS = [
    'happy', 'thinking', 'confused', 'shocked',
    'lgtm', 'sleeping', 'smirk', 'guilty',
    'angry', 'punch', 'exclusive', 'misc'
]

def slice_sheet(cat_name):
    sheet_path = f'assets/stickers/{cat_name}/sheet.png'
    if not os.path.exists(sheet_path):
        print(f"Sheet not found for {cat_name}")
        return

    img = Image.open(sheet_path)
    width, height = img.size
    
    # Grid is 3 rows, 4 columns
    tile_w = width // 4
    tile_h = height // 3
    
    print(f"Slicing {cat_name}... Sheet size: {width}x{height}, Tile size: {tile_w}x{tile_h}")

    for i, exp in enumerate(EXPRESSIONS):
        row = i // 4
        col = i % 4
        
        left = col * tile_w
        top = row * tile_h
        right = left + tile_w
        bottom = top + tile_h
        
        # Crop
        tile = img.crop((left, top, right, bottom))
        
        # Save
        out_path = f'assets/stickers/{cat_name}/{exp}.png'
        tile.save(out_path)
        print(f"  Saved {out_path}")

def main():
    base_dir = os.getcwd()
    print(f"Working in {base_dir}")
    
    for cat in CATS:
        slice_sheet(cat)

if __name__ == '__main__':
    main()
