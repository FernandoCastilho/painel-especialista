export const activityKinds = { comercio: 'Comércio', industria: 'Indústria', servicos: 'Serviços' }

const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export function findIbgeActivities(datasets, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  return datasets.flatMap(dataset => dataset.groups.map(group => ({ ...group, kind: dataset.kind, sector: activityKinds[dataset.kind] })))
    .filter(group => terms.every(term => normalize(`${group.label} ${group.id} ${group.sector}`).includes(term)))
}
