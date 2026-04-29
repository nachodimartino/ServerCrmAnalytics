import { MikroORM } from '@mikro-orm/postgresql'; // Importación específica del driver
import { Lead } from '../../leads/lead.entity.js';
import { mensajesLead } from '../../mensajesLead/mensajesLead.entity.js';
import { Lead_cluster_perfil } from '../../lead_cluster_perfil/lead_cluster_perfil.entity.js';
import { sql } from '@mikro-orm/postgresql';
// Usamos una función para inicializar y evitar el await en el nivel superior si el linter molesta,
// o simplemente ajustamos la sintaxis de v6.
export const orm = await MikroORM.init({
  entities: [Lead,mensajesLead,Lead_cluster_perfil],
  dbName: 'crm_analytics',
  clientUrl: process.env.DATABASE_URL,
  // En v6, al importar de '@mikro-orm/postgresql', el 'type' ya está implícito.
  debug: true,

schemaGenerator: {
    disableForeignKeys: false, // ¡OJO! Cámbialo a false para que se creen las FK
    createForeignKeyConstraints: true,
    ignoreSchema: [],
  },

});
console.log("Valores detectados:", {
  env: `|${process.env.NODE_ENV}|`, // Los pipes | nos ayudarán a ver espacios
  isDev: process.env.NODE_ENV?.trim() === 'development'
});

if (process.env.NODE_ENV?.trim() === 'development') {
  // ... tu lógica de sincronización
}
// 2. Ejecutamos la lógica de sincronización FUERA del objeto init
if (process.env.NODE_ENV === 'development') {
  const generator = orm.schema;
  try {
    // Esto nos devolverá el "ALTER TABLE..." que hace falta
    const sql = await generator.getUpdateSchemaSQL();
    console.log("🛠️ SQL pendiente:", sql);
    
    await generator.updateSchema();
    console.log("✨ [Database] Esquema sincronizado con éxito.");
  } catch (error) {
    console.error("❌ [Database] Error al sincronizar:", error);
  }
}