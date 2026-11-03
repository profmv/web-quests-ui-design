import re

with open('slides/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

slide_sections = re.findall(r'<section[^>]*class="slide[^"]*"[^>]*id="slide-(\d+)"', html)
print(f'Total slides found: {len(slide_sections)}')

titles = re.findall(r'<h[12][^>]*class="slide-title"[^>]*>(.*?)</h[12]>', html)
for i, title in enumerate(titles, start=1):
    clean_title = re.sub(r'&amp;', '&', title)
    clean_title = re.sub(r'&middot;', '-', clean_title)
    print(f'Slide {i:02d}: {clean_title}')
