export function destinationLabels(destinations) {
  const key = name => name.trim().toLowerCase();
  const counts = new Map();
  for (const { name } of destinations) {
    const normalized = key(name);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return new Map(destinations.map(({ id, name, url }) => {
    if (!url || counts.get(key(name)) === 1) return [id, name];
    const shortUrl = url.replace(/^https:\/\//, '').replace(/^(https?:\/\/)?([^/?#]+)\/$/, '$1$2');
    return [id, `${name} · ${shortUrl}`];
  }));
}
