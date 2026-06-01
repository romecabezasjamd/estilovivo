const FALLBACK_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSIyMCIgZmlsbD0iI2UyZThmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0iY2VudHJhbCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk0YTNiOCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiPj88L3RleHQ+PC9zdmc+';

export const FALLBACK_GARMENT = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNmNWY1ZjUiLz48cGF0aCBkPSJNNzUgNTBsLTIwIDI1aDEwbDEwIDE1IDEwLTE1aDEweiIgZmlsbD0iI2NjYyIvPjwvc3ZnPg==';

export const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>, fallback?: string) => {
  const img = e.currentTarget;
  if (img.src === fallback || img.src === FALLBACK_AVATAR) return;
  img.src = fallback || FALLBACK_AVATAR;
};

export const getAvatarUrl = (name?: string, avatar?: string): string => {
  if (avatar && avatar.startsWith('http')) return avatar;
  if (avatar && (avatar.startsWith('data:') || avatar.startsWith('blob:'))) return avatar;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '?')}&background=0F4C5C&color=fff`;
};

export const lazyLoadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

export const preloadImages = (urls: string[]): void => {
  urls.forEach(url => {
    if (url.startsWith('http') || url.startsWith('data:')) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    }
  });
};
