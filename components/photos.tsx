'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
type Photo = { url: string; name: string; width: number; height: number };
type Views = Partial<Record<'Front' | 'Side', Photo>>;
const Context = createContext<{ photos: Views; replace: (view: 'Front' | 'Side', photo?: Photo) => void }>({ photos: {}, replace: () => {} });
export function PhotoProvider({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<Views>({});
  const current = useRef(photos);
  useEffect(() => () => { Object.values(current.current).forEach(p => URL.revokeObjectURL(p.url)); }, []);
  function replace(view: 'Front' | 'Side', photo?: Photo) {
    const old = current.current[view];
    if (old) URL.revokeObjectURL(old.url);
    current.current = { ...current.current, [view]: photo };
    setPhotos(current.current);
  }
  return <Context.Provider value={{ photos, replace }}>{children}</Context.Provider>;
}
export const usePhotos = () => useContext(Context);
export async function loadPhoto(file: File): Promise<Photo> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error('Choose a JPEG, PNG or WebP photo up to 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 24_000_000) throw new Error('Use an image of 24 megapixels or less.');
    return { url, name: file.name, width: image.naturalWidth, height: image.naturalHeight };
  } catch (e) { URL.revokeObjectURL(url); throw e; }
}
