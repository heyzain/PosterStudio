function imageAsset(value) {
  return /\.(png|jpe?g|webp)$/i.test(value ?? '') ? value : null;
}

export function attachmentArtwork(value) {
  const id = value?.id;
  return imageAsset(id) ?? (id?.endsWith('.bin') && imageAsset(value.name) ? id : null);
}

export function destinationArtwork(destination, record) {
  return destination?.fields.filter(field => field.type === 'file' && !field.archived)
    .map(field => attachmentArtwork(record?.values?.[field.id])).find(Boolean) ?? null;
}
