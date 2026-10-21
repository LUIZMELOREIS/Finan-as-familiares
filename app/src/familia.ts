/**
 * Endereço da API desta família (App da Web do Apps Script).
 * Não é segredo: sem o token da família, a API não entrega nada além de "ping".
 * Pode ser sobrescrito no build com VITE_API_URL. Vazio = só modo demonstração.
 */
const PADRAO = 'https://script.google.com/macros/s/AKfycbxZHw24e9fdqUTNCfGKpTubkHYWggwYafxVTwWz7INU1IZhyWj62SG9pFVsF51d2xew/exec'

export const URL_API_PADRAO = (import.meta.env.VITE_API_URL || '').trim() || PADRAO
