-- 126_help_articles_es_staff_permissions.sql
-- RECONCILIATION MIGRATION -- this content is ALREADY LIVE in the database.
-- The Spanish backfill for the "Staff & Permissions" help category (28 of 28
-- articles) plus one English correction were applied via direct SQL writes,
-- outside migration history. This file exists so that history is complete and
-- the content is reproducible from the repo; it is written idempotently
-- (plain UPDATEs by primary key) so re-running it is a no-op against the
-- current live state rather than an error.
--
-- Generated from the live rows via quote_literal() rather than transcribed by
-- hand -- these are staff-facing instructions in a language the author of this
-- file does not verify natively, so a silent transcription typo was the real
-- risk to avoid.
--
-- Translation conventions locked for this pass (carry forward to the remaining
-- categories -- Troubleshooting 16, Getting Started 10, Inventory 9, Shopping 7):
--   * Register: usted, matching StaffOnboardingModal's existing Spanish
--     (messages/es.json:384 "Revise el Traspaso de Turno"). NOTE the app's own
--     Spanish is inconsistent -- some strings use tu ("tus tareas, deberes y
--     notas"). These articles follow usted; the app itself still needs to pick
--     one globally.
--   * Feature names taken verbatim from messages/es.json, never freshly
--     translated: Mi Dia, Traspaso de Turno, Inventario, Compras, Personal,
--     Centro de Tareas, Equipo, Herramientas, Etiquetas, Panel, Configuracion,
--     Centro de Ayuda.
--   * "Needs Linking" and "Household Knowledge Base" deliberately left in
--     ENGLISH -- neither has an es.json entry, so both render in English
--     on screen. Translating them here would send staff hunting for a button
--     whose label does not match. Household Knowledge Base carries a one-time
--     parenthetical Spanish gloss on first use (FAQ-041). If either label ever
--     gets a real es.json translation, these articles need a matching pass.
--   * Kashrut terminology intentionally untranslated -- none appears in this
--     category, so that convention is still untested until Recipes & Meals.

-- English correction, not a translation. FAQ-040 is the article a new staff
-- member reads first ("What should staff check first?") and it directed them
-- to "My Day -> Tasks -> Household Instructions" -- a page that has never
-- existed in this app. The app already contradicted itself here:
-- StaffOnboardingModal (messages/en.json:384) correctly said "Check Shift
-- Handover". Corrected to match the real feature.
update help_articles
set short_answer = 'Staff should open My Day, then read the Shift Handover.'
where id = 'FAQ-040';

update help_articles set question_es = '¿Todos en la casa necesitan acceso?', short_answer_es = 'No. El acceso depende del rol de cada persona y de si realmente lo necesita.', detailed_answer_es = 'No. El acceso depende del rol de la persona. Los roles son Propietario, Gerente y Personal, cada uno adaptado a necesidades operativas específicas.' where id = 'FAQ-005';
update help_articles set question_es = '¿El personal puede usarlo sin el propietario?', short_answer_es = 'Sí, si se le otorgan los permisos correspondientes.', detailed_answer_es = 'Sí, si se otorga el permiso. El personal puede realizar las rutinas diarias, manejar las listas de tareas y actualizar el Inventario de forma independiente según el rol asignado.' where id = 'FAQ-006';
update help_articles set question_es = '¿Qué debe revisar primero el personal?', short_answer_es = 'Abra Mi Día y luego lea el Traspaso de Turno.', detailed_answer_es = 'El personal debe comenzar cada turno abriendo Mi Día para ver sus tareas asignadas, y luego leyendo el Traspaso de Turno para ver las notas dejadas por el turno anterior o por el gerente.' where id = 'FAQ-040';
update help_articles set question_es = '¿Qué hago si no sé dónde va algo?', short_answer_es = 'Revise la ubicación en Inventario, busque en Household Knowledge Base, o pregunte a un supervisor.', detailed_answer_es = 'Primero revise los registros de ubicación en Inventario, luego busque en Household Knowledge Base (la base de conocimiento de la casa), y pregunte a un supervisor solo si el artículo sigue sin aparecer.' where id = 'FAQ-041';
update help_articles set question_es = '¿El personal debe crear artículos nuevos en el inventario?', short_answer_es = 'Solo si el rol de su cuenta le permite crear artículos.', detailed_answer_es = 'Solo si los permisos de su cuenta lo permiten. De lo contrario, informe los artículos faltantes al gerente por los canales establecidos.' where id = 'FAQ-042';
update help_articles set question_es = '¿Qué hago si falta algo?', short_answer_es = 'Registre de inmediato los artículos faltantes siguiendo el procedimiento de la casa.', detailed_answer_es = 'Registre el artículo como agotado o faltante según el procedimiento de reporte establecido en la casa.' where id = 'FAQ-043';
update help_articles set question_es = '¿Por qué usar la aplicación en lugar de mensajes de texto?', short_answer_es = 'La información en la aplicación queda organizada, centralizada y se puede buscar.', detailed_answer_es = 'Porque las instrucciones y solicitudes importantes quedan organizadas, centralizadas y se pueden buscar, en lugar de perderse en el historial de mensajes.' where id = 'FAQ-044';
update help_articles set question_es = '¿Quién debe tener acceso de administrador?', short_answer_es = 'Solo los gerentes de confianza responsables de la administración de la casa.', detailed_answer_es = 'Solo las personas de confianza directamente responsables de administrar la información de la casa (propietarios y gerentes principales).' where id = 'FAQ-045';
update help_articles set question_es = '¿Se pueden cambiar los permisos?', short_answer_es = 'Sí. El administrador puede cambiar los niveles de permiso en Configuración.', detailed_answer_es = 'Sí. Los perfiles de permisos se pueden actualizar en cualquier momento desde la administración de usuarios en Configuración.' where id = 'FAQ-046';
update help_articles set question_es = '¿Qué deben revisar los administradores con regularidad?', short_answer_es = 'Los usuarios activos, la calidad del Inventario, la lista Needs Linking y los estándares de la casa.', detailed_answer_es = 'Los administradores deben revisar periódicamente los usuarios activos, la calidad del Inventario, los artículos pendientes en Needs Linking y el cumplimiento de los estándares de la casa.' where id = 'FAQ-047';
update help_articles set question_es = '¿A quién contacto para obtener ayuda?', short_answer_es = 'Primero revise el Centro de Ayuda, luego siga el procedimiento de su casa.', detailed_answer_es = 'Primero revise el Centro de Ayuda y Household Knowledge Base. Si no se resuelve, siga el proceso de soporte establecido por el administrador de la casa.' where id = 'FAQ-053';
update help_articles set question_es = '¿Puedo asignar tareas a personas específicas?', short_answer_es = 'Sí. Las tareas se pueden asignar directamente a una cuenta de usuario.', detailed_answer_es = 'Sí. Las tareas individuales se pueden asignar directamente a familiares, gerentes o miembros del personal.' where id = 'FAQ-062';
update help_articles set question_es = '¿Qué hago si no sé cómo le gusta al propietario que se haga algo?', short_answer_es = 'Revise Household Knowledge Base antes de preguntar.', detailed_answer_es = 'Revise los estándares en Household Knowledge Base antes de preguntar. La mayoría de los métodos preferidos ya están documentados.' where id = 'FAQ-067';
update help_articles set question_es = '¿Por qué son importantes los estándares de la casa?', short_answer_es = 'Aseguran que todos los que ayudan en la casa sigan las mismas expectativas.', detailed_answer_es = 'Porque permiten que todas las personas que ayudan en la casa sigan exactamente las mismas expectativas, de forma constante y sin supervisión continua.' where id = 'FAQ-068';
update help_articles set question_es = '¿Qué hago si termino mis tareas antes de tiempo?', short_answer_es = 'Revise Mi Día para ver prioridades secundarias o necesidades generales de la casa.', detailed_answer_es = 'Revise Mi Día para ver las prioridades secundarias pendientes, el mantenimiento pendiente o las necesidades generales de preparación de la casa.' where id = 'FAQ-069';
update help_articles set question_es = '¿Qué hago si no puedo terminar una tarea?', short_answer_es = 'Actualice el estado de la tarea y explique el motivo en la aplicación.', detailed_answer_es = 'Actualice el estado de la tarea agregando una nota que explique el motivo, o comunique el problema por los canales establecidos en la aplicación.' where id = 'FAQ-070';
update help_articles set question_es = '¿Pueden usar la aplicación varias personas del personal?', short_answer_es = 'Sí. Cada persona entra con su propia cuenta individual.', detailed_answer_es = 'Sí. Varias personas del personal pueden entrar a la aplicación al mismo tiempo, cada una con su propia cuenta y su rol asignado.' where id = 'FAQ-071';
update help_articles set question_es = '¿El personal puede ver todo lo de la casa?', short_answer_es = 'No. El personal solo ve lo que permite el rol de su cuenta.', detailed_answer_es = 'Las cuentas del personal solo muestran la información permitida por su perfil de permisos.' where id = 'FAQ-072';
update help_articles set question_es = '¿Qué debe actualizar el personal con regularidad?', short_answer_es = 'Los artículos movidos, los suministros usados, las tareas completadas y las notas importantes.', detailed_answer_es = 'Los cambios importantes del día: artículos movidos de lugar, suministros usados o agotados, tareas completadas y notas generales de la casa.' where id = 'FAQ-073';
update help_articles set question_es = '¿En qué ayuda la aplicación al personal?', short_answer_es = 'Reemplaza la memoria y las instrucciones verbales por una estructura clara que se puede buscar.', detailed_answer_es = 'Reemplaza las instrucciones de memoria y las suposiciones por un sistema digital claro, confiable y fácil de consultar.' where id = 'FAQ-074';
update help_articles set question_es = '¿Qué hago si tengo una sugerencia para mejorar el sistema de la casa?', short_answer_es = 'Anótela en las notas de la casa dentro de la aplicación.', detailed_answer_es = 'Regístrela directamente en las notas de la casa o por el canal de sugerencias establecido en la aplicación.' where id = 'FAQ-075';
update help_articles set question_es = '¿Quién debe administrar el sistema?', short_answer_es = 'Normalmente el propietario o el gerente principal de la casa.', detailed_answer_es = 'Por lo general, el propietario principal o un gerente profesional designado, responsable del funcionamiento general de la casa.' where id = 'FAQ-086';
update help_articles set question_es = '¿Quién debe tener acceso de administrador?', short_answer_es = 'Solo los gerentes principales de confianza que manejan la información central.', detailed_answer_es = 'Solo las personas de confianza directamente responsables de organizar y administrar los registros digitales principales de la casa.' where id = 'FAQ-087';
update help_articles set question_es = '¿Los usuarios pueden tener permisos diferentes?', short_answer_es = 'Sí. El nivel de acceso se ajusta para cada cuenta.', detailed_answer_es = 'Sí. Los permisos son flexibles, de modo que cada usuario solo ve y edita lo necesario para su rol en la casa.' where id = 'FAQ-088';
update help_articles set question_es = '¿Por qué son importantes los permisos?', short_answer_es = 'Protegen la privacidad de la casa y evitan cambios accidentales en la información.', detailed_answer_es = 'Protegen la información delicada de la casa y evitan que se borren registros por accidente o que se cambien configuraciones sin autorización.' where id = 'FAQ-089';
update help_articles set question_es = '¿Qué deben revisar los administradores con regularidad?', short_answer_es = 'Los usuarios, la calidad del Inventario, Needs Linking y los estándares de la casa.', detailed_answer_es = 'Los usuarios, la calidad general del Inventario, los artículos sin vincular, la exactitud general del sistema y el cumplimiento de los estándares de la casa.' where id = 'FAQ-090';
update help_articles set question_es = '¿Cómo mantengo la información exacta?', short_answer_es = 'Haga actualizaciones pequeñas todos los días en lugar de esperar a una limpieza grande.', detailed_answer_es = 'Cree el hábito de hacer actualizaciones pequeñas en el momento, en lugar de dejar que la información se desactualice y requiera una limpieza grande después.' where id = 'FAQ-091';
update help_articles set question_es = '¿Qué pasa cuando alguien deja el equipo de la casa?', short_answer_es = 'Quite o ajuste de inmediato los permisos de su cuenta.', detailed_answer_es = 'Revise de inmediato la administración de usuarios y desactive o elimine los permisos de acceso de esa persona.' where id = 'FAQ-092';
