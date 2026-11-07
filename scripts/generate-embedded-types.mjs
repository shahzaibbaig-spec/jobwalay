import { writeFile } from 'node:fs/promises';
import { database } from './database-harness.mjs';
// Useful when Docker is unavailable: introspect the actual migrated PostgreSQL
// schema. Auth scaffolding is test-only and only public business types are emitted.
const db = await database();
const mapType = (type) => ({ uuid:'string', _uuid:'string[]', text:'string', date:'string', timestamptz:'string', bool:'boolean', int4:'number', int8:'number', numeric:'number', _text:'string[]', tsvector:'string', jsonb:'Json', void:'undefined' })[type] ?? 'unknown';
try {
  const {rows: columns}=await db.query(`select table_name,column_name,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`);
  const {rows: relations}=await db.query(`select c.conname, child.relname as child, parent.relname as parent,
    array(select a.attname from unnest(c.conkey) with ordinality k(attnum,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum order by k.ord) as columns,
    array(select a.attname from unnest(c.confkey) with ordinality k(attnum,ord) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.attnum order by k.ord) as referenced_columns,
    exists(select 1 from pg_constraint u where u.conrelid=c.conrelid and u.contype in ('p','u') and u.conkey=c.conkey) as one_to_one
    from pg_constraint c join pg_class child on child.oid=c.conrelid join pg_namespace ns on ns.oid=child.relnamespace
    join pg_class parent on parent.oid=c.confrelid join pg_namespace pns on pns.oid=parent.relnamespace
    where c.contype='f' and ns.nspname='public' and pns.nspname='public' order by c.conname`);
  const {rows: functions}=await db.query(`select p.proname,p.proargnames,p.pronargdefaults,
    array(select t.typname from unnest(p.proargtypes::oid[]) with ordinality x(oid,ord) join pg_type t on t.oid=x.oid order by x.ord) as arg_types,
    t.typname as return_type from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type t on t.oid=p.prorettype where n.nspname='public' order by p.proname`);
  const tableNames=[...new Set(columns.map(c=>c.table_name))];
  const tables=tableNames.map(table=> {
    const fields=columns.filter(c=>c.table_name===table);
    const shape=(mode)=>fields.map(c=>`          ${c.column_name}${mode==='Update'||(mode==='Insert'&&(c.column_default!==null||c.is_nullable==='YES'))?'?':''}: ${mapType(c.udt_name)}${c.is_nullable==='YES'?' | null':''};`).join('\n');
    const relationships=relations.filter(r=>r.child===table).map(r=>`          { foreignKeyName: ${JSON.stringify(r.conname)}; columns: ${JSON.stringify(r.columns)}; isOneToOne: ${r.one_to_one}; referencedRelation: ${JSON.stringify(r.parent)}; referencedColumns: ${JSON.stringify(r.referenced_columns)}; }`).join(',\n');
    return `      ${table}: {\n        Row: {\n${shape('Row')}\n        };\n        Insert: {\n${shape('Insert')}\n        };\n        Update: {\n${shape('Update')}\n        };\n        Relationships: [\n${relationships}\n        ];\n      };`;
  }).join('\n');
  const funcs=functions.map(f=>`      ${f.proname}: { Args: ${f.proargnames?.length?`{ ${f.proargnames.map((name,i)=>`${name}${i>=f.proargnames.length-f.pronargdefaults?'?':''}: ${mapType(f.arg_types[i])}`).join('; ')} }`:'Record<PropertyKey, never>'}; Returns: ${mapType(f.return_type)} };`).join('\n');
  await writeFile('src/types/database.ts',`// Generated from the migrated PostgreSQL catalog by scripts/generate-embedded-types.mjs.\n// Prefer npm run db:types against the full local Supabase stack when available.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = {\n  public: {\n    Tables: {\n${tables}\n    };\n    Views: { [_ in never]: never };\n    Functions: {\n${funcs}\n    };\n    Enums: { [_ in never]: never };\n    CompositeTypes: { [_ in never]: never };\n  };\n};\n`);
  console.log('Generated public database types from the applied migration.');
} finally { await db.close(); }
