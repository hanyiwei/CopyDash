import { isImageUrl, isUrl } from './urlDetect';

export const clipMatchesType = (clip: any, kind: string) => {
  const txt = clip.content_text || '';
  switch (kind) {
    case 'text': return clip.type === 1 && !clip.has_color && !isUrl(txt) && !isImageUrl(txt);
    case 'image': return clip.type === 2;
    case 'link': return clip.type === 1 && (isUrl(txt) || isImageUrl(txt));
    case 'color': return !!clip.has_color;
    case 'file': return clip.type === 4;
    default: return false;
  }
};
