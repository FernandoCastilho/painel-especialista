// Usado pela coleta de cotações (quotes.yml): sai com 0 se o câmbio brasileiro está aberto agora (dia de pregão da B3, 9h05 às 18h de Brasília).
import { fxSessionOpen } from './data-schedules.mjs'
process.exit(fxSessionOpen() ? 0 : 1)
