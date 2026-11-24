// Ofício Circular 057/2026-VNC, 17/11/2026. Quadro A: fechamento de listados.
// Não é calendário civil, contratual, de câmbio à vista ou de liquidação.
export const B3_CALENDAR_2027_SOURCE = 'https://www.b3.com.br/data/files/30/44/54/98/ECAE1A108E6A2C1AAC094EA8/OC%20057-2026-VNC%20CALENDARIO%20DE%20FERIADOS%20EM%202027%20E%20FUNCIONAMENTO%20DA%20B3%20EM%2010022027%20QUARTAFEIRA%20DE%20CINZAS_PT.pdf'
export const B3_LISTED_2027_CLOSED = Object.freeze({
  '01-01': 'Confraternização Universal',
  '02-08': 'Carnaval (segunda)',
  '02-09': 'Carnaval (terça)',
  '03-26': 'Sexta-feira Santa',
  '04-21': 'Tiradentes',
  '05-27': 'Corpus Christi',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '12-24': 'B3 · sem sessão de negociação (véspera de Natal)',
  '12-31': 'B3 · sem sessão de negociação (véspera de Ano Novo)',
})
// Anexo 2, seção 1.1: derivativos financeiros e de commodities, não spot.
export const B3_LISTED_2027_SPECIAL = Object.freeze({ date: '2027-02-10', openMinute: 13 * 60 })
export const B3_BALCAO_2027_EXCEPTIONS = Object.freeze(['2027-12-24', '2027-12-31'])
