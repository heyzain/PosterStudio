export function imageAsset(value) {
  return /\.(png|jpe?g|webp)$/i.test(value ?? '') ? value : null;
}

export function destinationArtwork(destination, record) {
  return destination?.fields.filter(field => field.type === 'file' && !field.archived)
    .map(field => imageAsset(record?.values?.[field.id]?.id)).find(Boolean) ?? null;
}
