import { useEffect, useRef } from 'react';

export function useDraftAssets(discardAssets) {
  const ids = useRef(new Set());
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
      if (ids.current.size) void discardAssets([...ids.current]);
      ids.current.clear();
    };
  }, [discardAssets]);

  return async request => {
    const asset = await request;
    if (asset && open.current) ids.current.add(asset.id);
    if (asset && !open.current) {
      void discardAssets([asset.id]);
      return null;
    }
    return asset;
  };
}
