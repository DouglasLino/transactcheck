import { useEffect, useState } from 'react';
import { Accordion, AccordionTab } from 'primereact/accordion';
import { Tag } from 'primereact/tag';
import { engineClient } from '../services/engineClient';
import { useEngine } from '../context/EngineContext';
import { PageHeader } from '../components/PageHeader';

const titles: Record<string, { title: string; description: string; icon: string }> = {
  field_aliases: { title: 'Alias y reconocimiento de campos', description: 'Nombres exactos y apoyo léxico conservador.', icon: 'pi-tags' },
  currency_aliases: { title: 'Monedas ISO 4217', description: 'Catálogo embebido, alias inequívocos y símbolos ambiguos.', icon: 'pi-dollar' },
  status_mappings: { title: 'Estados normalizados', description: 'Catálogo cerrado y equivalencias explícitas.', icon: 'pi-check-square' },
  date_formats: { title: 'Fechas', description: 'ISO 8601 y tratamiento de fechas con barras.', icon: 'pi-calendar' },
  detection_rules: { title: 'Detección de objetos', description: 'Criterios para transacción, contenedor y objeto no identificado.', icon: 'pi-search' },
};

function RulesSummary({ name, value }: { name: string; value: unknown }) {
  if (name === 'status_mappings') {
    const config = value as { catalog: string[]; mappings: Record<string, string>; intentionallyUnmapped: string[] };
    return <div className="rules-content"><h4>Catálogo</h4><div className="tag-cloud">{config.catalog.map((item) => <Tag key={item} value={item} />)}</div><h4>Equivalencias</h4><div className="mapping-grid">{Object.entries(config.mappings).map(([from, to]) => <div key={from}><code>{from}</code><i className="pi pi-arrow-right" /><strong>{to}</strong></div>)}</div><h4>Sin equivalencia universal</h4><p>{config.intentionallyUnmapped.join(', ')}</p></div>;
  }
  if (name === 'field_aliases') {
    const config = value as { fields: Record<string, string[]>; matching: Record<string, unknown>; forbiddenAmountAliases: string[] };
    return <div className="rules-content"><div className="mapping-grid wide">{Object.entries(config.fields).map(([field, aliases]) => <div key={field}><strong>{field}</strong><span>{aliases.join(', ')}</span></div>)}</div><h4>Comparación aproximada</h4><p>Solo variaciones tipográficas de una edición, similitud mínima {String(config.matching.minimumRatio)} y respaldo de otro campo transaccional. Nunca se usa para equiparar conceptos distintos.</p><h4>Exclusiones de monto</h4><p>{config.forbiddenAmountAliases.join(', ')}</p></div>;
  }
  if (name === 'currency_aliases') {
    const config = value as { catalogSource: string; catalog: string[]; aliases: Record<string, string>; ambiguousSymbols: string[] };
    return <div className="rules-content"><p>{config.catalogSource}. {config.catalog.length} códigos disponibles.</p><div className="mapping-grid">{Object.entries(config.aliases).map(([from, to]) => <div key={from}><code>{from}</code><i className="pi pi-arrow-right" /><strong>{to}</strong></div>)}</div><h4>Símbolos ambiguos</h4><p>{config.ambiguousSymbols.join(', ')} se normaliza como UNKNOWN sin contexto confiable.</p></div>;
  }
  return <pre className="rules-json">{JSON.stringify(value, null, 2)}</pre>;
}

export function RulesPage() {
  const { ready } = useEngine();
  const [rules, setRules] = useState<Record<string, unknown>>({});
  useEffect(() => { if (ready) void engineClient.getRules().then(setRules); }, [ready]);
  return <div className="page rules-page"><PageHeader eyebrow="Consulta de solo lectura" title="Reglas aplicadas" description="Estas configuraciones versionadas gobiernan la detección y normalización. No se modifican desde la interfaz." />
    <section className="rule-principles"><div><i className="pi pi-shield" /><strong>Conservador</strong><span>La ambigüedad no se resuelve arbitrariamente.</span></div><div><i className="pi pi-calculator" /><strong>Decimal exacto</strong><span>Ningún cálculo monetario usa float.</span></div><div><i className="pi pi-eye" /><strong>Inspeccionable</strong><span>Alias y catálogos viven fuera del código.</span></div></section>
    <Accordion multiple activeIndex={[0]}>{Object.entries(rules).map(([name, value]) => { const metadata = titles[name]; return <AccordionTab key={name} header={<span className="rule-header"><i className={`pi ${metadata?.icon ?? 'pi-cog'}`} /><span><strong>{metadata?.title ?? name}</strong><small>{metadata?.description}</small></span></span>}><RulesSummary name={name} value={value} /></AccordionTab>; })}</Accordion>
  </div>;
}

