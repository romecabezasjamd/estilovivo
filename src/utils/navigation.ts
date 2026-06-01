/** Navegación unificada: "create" / createLook → Armario > Looks > Crear Look */
export const resolveNavigation = (
  tab: string,
  subTab?: string
): { tab: string; wardrobeIntent?: 'looks' | 'createLook' } => {
  if (tab === 'create' || subTab === 'createLook') {
    return { tab: 'wardrobe', wardrobeIntent: 'createLook' };
  }
  if (tab === 'wardrobe' && subTab === 'looks') {
    return { tab: 'wardrobe', wardrobeIntent: 'looks' };
  }
  return { tab, wardrobeIntent: undefined };
};
