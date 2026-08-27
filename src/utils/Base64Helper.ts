import pako from 'pako';
// Helper kiểm tra base64
export function isBase64(str: string): boolean {
  const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*?(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  return base64Pattern.test(str.trim());
}


export function base64ToXml(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  try {
    return pako.ungzip(bytes, { to: 'string' });
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

export function parseXmlToJson(xml: string): Record<string, string>[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const records: Record<string, string>[] = [];

  const root = doc.documentElement;

  const allChiTietLists = Array.from(doc.getElementsByTagName('*')).filter((el) =>
    el.tagName.startsWith('DSACH_'),
  );

  if (allChiTietLists.length > 0) {
    allChiTietLists.forEach((dsach) => {
      for (let i = 0; i < dsach.children.length; i++) {
        const item = dsach.children[i];
        const record: Record<string, string> = {};
        for (let j = 0; j < item.children.length; j++) {
          const field = item.children[j];
          record[field.nodeName] = field.textContent || '';
        }
        if (Object.keys(record).length > 0) {
          records.push(record);
        }
      }
    });
  } else {
    // Fallback: parse tất cả field ngay dưới gốc nếu không có DSACH_
    const record: Record<string, string> = {};
    for (let i = 0; i < root.children.length; i++) {
      const field = root.children[i];
      record[field.nodeName] = field.textContent || '';
    }
    if (Object.keys(record).length > 0) {
      records.push(record);
    }
  }
  return records;
}
