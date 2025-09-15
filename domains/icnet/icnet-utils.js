/*****************************************************
 * domains/icnet/icnet-utils.js
 * Utilitários específicos do domínio ICNET.
 * - Breadcrumb "lbPath" (último da página)
 * - Nome da IC a partir dos selects conhecidos
 * - Seleção de blocos/tabelas no padrão ICNET
 * - Geração de nomes de arquivo usando regras globais
 *****************************************************/

import {
    rule_sanitize_token,
    rule_join_tokens,
    rule_timestamp_token,
    rule_make_filename
} from "../../core/global-rules.js";

/**
 * Retorna o ÚLTIMO breadcrumb (#lbPath) presente no documento
 * (ICNET às vezes renderiza mais de um, ex.: iframes aninhados).
 */
export function icnet_readBreadcrumbLast(doc = document) {
    const nodes = Array.from(doc.querySelectorAll("#TbPathAndNavigation #lbPath"));
    const el = nodes.length ? nodes[nodes.length - 1] : null;
    const raw = el ? (el.textContent || "").trim() : "";
    return { raw, el };
}

/** Converte o breadcrumb do ICNET para um token seguro (minúsculo/sem acento/espaço). */
export function icnet_breadcrumb_token(doc = document) {
    const { raw } = icnet_readBreadcrumbLast(doc);
    return rule_sanitize_token(raw) || "grid";
}

/**
 * Obtém o nome da IC (JURISCONS, etc.) a partir dos selects conhecidos no ICNET
 * e devolve já tokenizado. Fallback: "ic".
 */
export function icnet_ic_token(doc = document) {
    const sel =
        doc.querySelector("#navbarIC select") ||
        doc.querySelector("#ddList_ICs") ||
        doc.querySelector('select[name="ddList_ICs"]');

    if (sel && sel.options && sel.selectedIndex >= 0) {
        const txt = sel.options[sel.selectedIndex].text || sel.value || "";
        const v = (txt || "").trim();
        if (v) return rule_sanitize_token(v);
    }
    return "ic";
}

/**
 * Encontra os containers FormEntry que possuam GridStyle (padrão ICNET).
 * Observação: esse seletor é específico do ICNET.
 */
export function icnet_findFormEntriesWithGrid(doc = document) {
    const entries = Array.from(doc.querySelectorAll("div.FormEntry"));
    return entries.filter((entry) => entry.querySelector("table.GridStyle"));
}

/**
 * Gera um nome de arquivo padronizado para ICNET:
 * icnet-<ic>-<breadcrumb>-<timestamp>.<ext>
 */
export function icnet_make_filename(ext = "csv", doc = document, now = new Date()) {
    const ic = icnet_ic_token(doc);
    const bc = icnet_breadcrumb_token(doc);
    return rule_make_filename(["icnet", ic, bc], ext, now);
}

// (re-export) Conveniência para módulos do icnet:
export {
    rule_sanitize_token,
    rule_join_tokens,
    rule_timestamp_token,
    rule_make_filename
} from "../../core/global-rules.js";
