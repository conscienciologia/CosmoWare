/*****************************************************
 * core/global-rules.js
 * Regras globais independentes de domínio.
 * Foco: normalização e composição de nomes de arquivo.
 *****************************************************/

/**
 * Regra de normalização de tokens.
 * - minúsculo
 * - sem acentos/diacríticos
 * - troca qualquer caractere não [a-z0-9] por "_"
 * - remove "_" duplicados e bordas
 */
export function rule_sanitize_token(s) {
    return (s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

/**
 * Junta vários tokens aplicando a regra de normalização em cada parte,
 * removendo vazias e usando separador (default "-").
 */
export function rule_join_tokens(parts, sep = "-") {
    const safe = (Array.isArray(parts) ? parts : [parts])
        .map(rule_sanitize_token)
        .filter(Boolean);
    return safe.join(sep);
}

/**
 * Timestamp em formato de token estável para nomes de arquivo: yyyymmdd-hhmmss
 */
export function rule_timestamp_token(d = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return (
        d.getFullYear().toString() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        "-" +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds())
    );
}

/**
 * Monta um nome de arquivo padronizado:
 * rule_join_tokens(parts) + "-" + rule_timestamp_token() + "." + ext
 * Ex.: rule_make_filename(["icnet", ic, breadcrumb], "csv")
 */
export function rule_make_filename(parts, ext = "txt", d = new Date()) {
    const stem = rule_join_tokens(parts);
    const ts = rule_timestamp_token(d);
    const safeExt = rule_sanitize_token(ext) || "txt";
    return `${stem}-${ts}.${safeExt}`;
}
