// Experimento opt-in, limitado ao processo efêmero deste smoke.
module.exports = function captureRasterOptions(options, env = process.env) {
 const mode = env.CAPTURE_TEXT_RASTER || 'normal'
 if (!['normal', 'grayscale'].includes(mode)) throw new Error('CAPTURE_TEXT_RASTER inválido: ' + mode)
 if (mode === 'normal') return options
 if (env.CAPTURE_REFERENCE_MODE !== 'device') throw new Error('Experimento grayscale exige referência device; gate legado permanece intacto')
 return { ...options, args: [...(options.args || []), '--disable-lcd-text'] }
}
