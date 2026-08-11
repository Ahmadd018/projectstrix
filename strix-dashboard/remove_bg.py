import sys
from PIL import Image

def make_transparent(img_path):
    try:
        img = Image.open(img_path).convert("RGBA")
        datas = img.getdata()
        
        newData = []
        for item in datas:
            # Əgər piksel ağ və ya ağa çox yaxındırsa (R, G, B > 220)
            if item[0] > 220 and item[1] > 220 and item[2] > 220:
                newData.append((255, 255, 255, 0)) # Şəffaf (Transparent)
            else:
                newData.append(item)
                
        img.putdata(newData)
        img.save(img_path, "PNG")
        print("Success! Background removed.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    make_transparent(r"c:\Users\guliyevaa\Documents\strixFullApp\strix-dashboard\public\logo.png")
