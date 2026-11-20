// Criterion texts for the Spanish reports. Keys are criterion ids (queries.ts).
import type { CriterionText } from "./types";
export const ES: Record<string, CriterionText> = {
  i1: {
    label: "Cobertura de CPU de hosts",
    description: "Porcentaje de hosts monitoreados con métricas activas de uso de CPU de cualquier fuente (OneAgent, OTel, integración de nube).",
    action: "Despliegue OneAgent en todos los hosts para recopilar métricas de uso de CPU, o ingéstelas mediante OTel o la integración de nube.",
  },
  i2: {
    label: "Cobertura de memoria de hosts",
    description: "Porcentaje de hosts monitoreados con métricas activas de uso de memoria.",
    action: "Verifique la recopilación de métricas de memoria de OneAgent. Active el monitoreo de memoria en la configuración del host.",
  },
  i3: {
    label: "Cobertura de disco de hosts",
    description: "Porcentaje de hosts monitoreados con métricas activas de utilización de disco.",
    action: "Asegúrese de que el monitoreo de disco esté activado en la configuración de OneAgent para tener visibilidad de la utilización del almacenamiento.",
  },
  i4: {
    label: "Cobertura de disponibilidad de hosts",
    description: "Porcentaje de hosts monitoreados con métricas de disponibilidad — base para los informes de SLA.",
    action: "Confirme que se estén recopilando las métricas de disponibilidad de los hosts. Revise la configuración de monitoreo de hosts y de SLA.",
  },
  i5: {
    label: "Cobertura de red de hosts",
    description: "Porcentaje de hosts monitoreados con entidades de interfaz de red.",
    action: "Active el monitoreo de red en la configuración de OneAgent para obtener métricas de tráfico por interfaz en los hosts.",
  },
  i6: {
    label: "Cobertura de CPU de procesos",
    description: "Porcentaje de grupos de procesos con métricas activas de uso de CPU.",
    action: "Active el monitoreo a nivel de proceso en OneAgent para capturar métricas de uso de CPU por proceso.",
  },
  i7: {
    label: "Cobertura de clusters K8s",
    description: "Porcentaje de clusters de Kubernetes con monitoreo activo de workloads.",
    action: "Conecte los clusters de Kubernetes mediante Dynatrace Operator para un monitoreo full-stack de K8s.",
  },
  i8: {
    label: "Cobertura de entidades de disco de hosts",
    description: "Porcentaje de hosts con entidades de disco detectadas.",
    action: "Verifique que se detecten las entidades de disco en los hosts. Active el monitoreo de disco en la configuración de OneAgent.",
  },
  i9: {
    label: "Cobertura de problemas de Davis",
    description: "Porcentaje de hosts cubiertos por la detección de problemas de Davis AI.",
    action: "Verifique que Davis AI esté activado y que la configuración de detección de anomalías esté definida para la infraestructura.",
  },
  i10: {
    label: "Cobertura de workloads de nube",
    description: "Porcentaje de namespaces de K8s con workloads nativos de nube en ejecución.",
    action: "Active la integración con la plataforma de nube (AWS, Azure, GCP) para descubrir workloads de K8s nativos de nube.",
  },
  i11: {
    label: "Topología host-proceso",
    description: "Porcentaje de hosts con grupos de procesos detectados — valida el descubrimiento de relaciones entre entidades.",
    action: "Asegúrese de que OneAgent esté en ejecución en los hosts para que los grupos de procesos se detecten automáticamente y se mapee la topología.",
  },
  i12: {
    label: "Mapeo de workloads K8s",
    description: "Porcentaje de clusters de Kubernetes con al menos un namespace de aplicación de nube detectado — valida la topología de workloads.",
    action: "Verifique que los workloads a nivel de namespace de K8s se detecten mediante Dynatrace Operator para la topología de workloads.",
  },
  i13: {
    label: "Enriquecimiento de logs de hosts de nube",
    description: "Porcentaje de hosts con contexto del proveedor de nube en los datos de logs — valida que la integración de nube aporte metadatos a nivel de host.",
    action: "Active la integración con la plataforma de nube y verifique que los logs a nivel de host incluyan los metadatos cloud.provider.",
  },
  i14: {
    label: "Enriquecimiento de logs de nube",
    description: "Porcentaje de registros de log enriquecidos con metadatos del proveedor de nube.",
    action: "Configure la integración de nube para enriquecer los registros de log con el contexto cloud.provider mediante OpenPipeline.",
  },
  i15: {
    label: "Enriquecimiento de región de nube",
    description: "Porcentaje de logs enriquecidos con datos de nube que también contienen metadatos de región — valida la profundidad de la observabilidad multirregión.",
    action: "Asegúrese de que la integración de nube incluya el atributo cloud.region. Verifique la cobertura multirregión en los datos de logs.",
  },
  i16: {
    label: "Enriquecimiento de AZ de nube",
    description: "Porcentaje de logs enriquecidos con datos de nube que tienen metadatos de zona de disponibilidad — valida la observabilidad de la resiliencia entre dominios de falla.",
    action: "Active los metadatos de zona de disponibilidad en la integración de nube para tener visibilidad de los dominios de falla.",
  },
  i17: {
    label: "Enriquecimiento de cuenta de nube",
    description: "Porcentaje de logs enriquecidos con datos de nube que tienen metadatos de ID de cuenta — valida la gobernanza de nube multicuenta.",
    action: "Configure la integración de nube para incluir cloud.account.id para la gobernanza multicuenta.",
  },
  i18: {
    label: "Enriquecimiento de spans de nube",
    description: "Porcentaje de servicios con contexto del proveedor de nube en los datos de spans.",
    action: "Verifique que el contexto cloud.provider esté presente en los datos de spans mediante las integraciones con la plataforma de nube.",
  },
  i19: {
    label: "Profundidad de monitoreo de nodos K8s",
    description: "Relación entre nodos y clusters de K8s — valida el monitoreo del cómputo de nube a nivel de nodo.",
    action: "Asegúrese de que Dynatrace Operator esté recopilando métricas a nivel de nodo de los clusters de K8s.",
  },
  i20: {
    label: "Cobertura de métricas de namespaces de nube",
    description: "Porcentaje de namespaces de K8s con métricas activas de contenedores — valida la observabilidad de los workloads de nube.",
    action: "Verifique que las métricas de contenedores a nivel de namespace de K8s estén llegando mediante Dynatrace Operator.",
  },
  i21: {
    label: "Monitoreo de reinicios de contenedores",
    description: "Porcentaje de namespaces de K8s con seguimiento de reinicios de contenedores — fundamental para detectar problemas de CrashLoopBackOff y OOM.",
    action: "Active el seguimiento de reinicios de contenedores mediante Dynatrace Operator para detectar CrashLoopBackOff y OOMKill.",
  },
  i22: {
    label: "Límites de recursos de contenedores",
    description: "Porcentaje de namespaces de K8s con límites de recursos definidos — esencial para la estabilidad del cluster y la gobernanza de recursos.",
    action: "Defina límites de recursos de CPU y memoria en los workloads de K8s para la estabilidad del cluster y la gobernanza.",
  },
  i23: {
    label: "Problemas con causa raíz",
    description: "Proporción de problemas de Davis en entidades de infraestructura (hosts, procesos, Kubernetes, nube, dispositivos personalizados) en las últimas 72 h en los que Davis identificó una entidad de causa raíz.",
    action: "Cierre las brechas de monitoreo en las entidades afectadas para que Davis pueda atribuir una causa raíz; revise los problemas que terminan sin ella.",
  },
  i24: {
    label: "Problemas con respuesta automatizada",
    description: "Proporción de problemas de Davis en entidades de infraestructura (hosts, procesos, Kubernetes, nube, dispositivos personalizados) en las últimas 72 h que activaron al menos una ejecución de workflow.",
    action: "Cree un workflow activado por problemas que dirija el problema a su responsable (ITSM, chat) o ejecute una remediación preaprobada.",
  },
  i25: {
    label: "Workflows de automatización de infraestructura",
    description: "Workflows que ejecutaron una acción de nube, de Kubernetes o de gestión de configuración (conectores de AWS, Azure, GCP, Kubernetes, Ansible) en las últimas 24 h.",
    action: "Agregue a un workflow una acción de un conector de nube o de Kubernetes, por ejemplo para reiniciar, escalar o etiquetar un recurso cuando se abre un problema.",
  },
  i26: {
    label: "Uso de Assist, MCP y dtctl",
    description: "Personas que consultaron métricas y topología mediante Dynatrace Assist, un cliente MCP o la CLI dtctl en los últimos 30 días.",
    action: "Presente Dynatrace Assist al equipo responsable de estos datos y conecte su IDE o agente de programación mediante el servidor MCP de Dynatrace o dtctl.",
  },
  a1: {
    label: "Cobertura de trazado de servicios",
    description: "Porcentaje de servicios detectados con datos de spans activos en las últimas 2 h (OneAgent u OTel).",
    action: "Despliegue OneAgent en los servidores de aplicaciones o ingeste traces de OpenTelemetry para la detección de servicios.",
  },
  a2: {
    label: "Cobertura de métodos de servicios",
    description: "Porcentaje de servicios con trazado a nivel de método.",
    action: "Active el trazado a nivel de método en la configuración del servicio. Use reglas de sensores para una visibilidad más profunda.",
  },
  a3: {
    label: "Cobertura de spans raíz",
    description: "Porcentaje de servicios con spans raíz (solicitudes entrantes) en las últimas 2 h.",
    action: "Asegúrese de que se capturen los spans raíz (solicitudes entrantes). Revise la instrumentación de OneAgent u OTel en los puntos de entrada.",
  },
  a4: {
    label: "Cobertura de instrumentación OTel",
    description: "Porcentaje de servicios con spans de OpenTelemetry — adopción de instrumentación independiente del proveedor.",
    action: "Instrumente las aplicaciones con el SDK de OpenTelemetry o configure OTel Collector para exportar a Dynatrace.",
  },
  a5: {
    label: "Cobertura de tiempo de respuesta",
    description: "Porcentaje de servicios con métricas de tiempo de respuesta (p95).",
    action: "Confirme que las métricas de tiempo de respuesta de los servicios (p95) estén llegando. Active los percentiles de tiempo de respuesta en la configuración.",
  },
  a6: {
    label: "Cobertura de seguimiento de fallas",
    description: "Porcentaje de servicios con métricas de tasa de fallas.",
    action: "Active las reglas de detección de fallas y verifique que se capturen las métricas de tasa de fallas en los servicios.",
  },
  a7: {
    label: "Cobertura de throughput",
    description: "Porcentaje de servicios con métricas de cantidad de solicitudes/throughput.",
    action: "Verifique que las métricas de cantidad de solicitudes y de throughput estén activas. Revise la configuración de monitoreo de servicios.",
  },
  a8: {
    label: "Cobertura de spans de base de datos",
    description: "Porcentaje de servicios con spans de operaciones de base de datos.",
    action: "Asegúrese de que las llamadas a bases de datos se tracen. Active la captura de solicitudes de base de datos en la configuración del servicio.",
  },
  a9: {
    label: "Cobertura de spans de mensajería",
    description: "Porcentaje de servicios con spans de mensajería (Kafka, RabbitMQ, SQS).",
    action: "Active el trazado de colas de mensajes para Kafka, RabbitMQ, SQS y otros sistemas de mensajería.",
  },
  a10: {
    label: "Profundidad de traces multiservicio",
    description: "Porcentaje de traces que abarcan 2 o más servicios — valida la profundidad del trazado distribuido.",
    action: "Asegúrese de que los traces distribuidos abarquen 2 o más servicios. Revise la correlación entre servicios y la propagación de contexto.",
  },
  a11: {
    label: "Mapeo servicio-proceso",
    description: "Porcentaje de servicios con grupos de procesos asociados — valida la topología de servicio a infraestructura.",
    action: "Verifique que los servicios tengan grupos de procesos asociados para el mapeo de la topología de servicio a infraestructura.",
  },
  a13: {
    label: "Profundidad de llamadas a bases de datos",
    description: "Porcentaje de servicios que usan bases de datos e interactúan con 2 o más sistemas de base de datos — valida el monitoreo profundo de bases de datos en todo el stack.",
    action: "Active el trazado profundo de llamadas a bases de datos en los servicios. Asegúrese de que los servicios conectados a varios sistemas de base de datos tengan registrados todos los atributos db.system.",
  },
  a14: {
    label: "Problemas con causa raíz",
    description: "Proporción de problemas de Davis en servicios y colas en las últimas 72 h en los que Davis identificó una entidad de causa raíz.",
    action: "Cierre las brechas de monitoreo en las entidades afectadas para que Davis pueda atribuir una causa raíz; revise los problemas que terminan sin ella.",
  },
  a15: {
    label: "Problemas con respuesta automatizada",
    description: "Proporción de problemas de Davis en servicios y colas en las últimas 72 h que activaron al menos una ejecución de workflow.",
    action: "Cree un workflow activado por problemas que dirija el problema a su responsable (ITSM, chat) o ejecute una remediación preaprobada.",
  },
  a16: {
    label: "Uso de Assist, MCP y dtctl",
    description: "Personas que consultaron traces mediante Dynatrace Assist, un cliente MCP o la CLI dtctl en los últimos 30 días.",
    action: "Presente Dynatrace Assist al equipo responsable de estos datos y conecte su IDE o agente de programación mediante el servidor MCP de Dynatrace o dtctl.",
  },
  d1: {
    label: "Cobertura de acciones RUM",
    description: "Porcentaje de aplicaciones web con métricas activas de acciones de usuario.",
    action: "Cree una aplicación web en Dynatrace e inyecte el fragmento de JavaScript de RUM para el seguimiento de las acciones de usuario.",
  },
  d2: {
    label: "Cobertura de seguimiento de sesiones",
    description: "Porcentaje de aplicaciones web con seguimiento de sesiones activo.",
    action: "Active el seguimiento de sesiones en la configuración de su aplicación RUM para capturar las sesiones de usuario.",
  },
  d3: {
    label: "Cobertura de LCP",
    description: "Porcentaje de aplicaciones web con métricas de Largest Contentful Paint — Core Web Vital.",
    action: "Active la captura de Largest Contentful Paint (LCP) en la configuración de RUM. Optimice para un objetivo de <2.5s.",
  },
  d4: {
    label: "Cobertura de INP",
    description: "Porcentaje de aplicaciones web con métricas de Interaction to Next Paint — Core Web Vital.",
    action: "Active el seguimiento de Interaction to Next Paint (INP) en la configuración de RUM. Objetivo: <200ms.",
  },
  d5: {
    label: "Cobertura de CLS",
    description: "Porcentaje de aplicaciones web con métricas de Cumulative Layout Shift — Core Web Vital.",
    action: "Active el seguimiento de Cumulative Layout Shift (CLS) en la configuración de RUM. Objetivo: CLS <0.1.",
  },
  d6: {
    label: "Cobertura de errores de frontend",
    description: "Porcentaje de aplicaciones web con el seguimiento de errores activado.",
    action: "Active el seguimiento de errores de JavaScript en la configuración de la aplicación RUM para tener visibilidad de los errores de frontend.",
  },
  d7: {
    label: "Cobertura de Synthetic HTTP",
    description: "Porcentaje de aplicaciones web cubiertas por monitores sintéticos HTTP.",
    action: "Cree monitores HTTP en Synthetic Monitoring para comprobar la disponibilidad y los tiempos de respuesta de los endpoints.",
  },
  d8: {
    label: "Cobertura de Synthetic de navegador",
    description: "Porcentaje de aplicaciones web cubiertas por pruebas sintéticas basadas en navegador.",
    action: "Cree monitores de navegador de tipo clickpath para simular recorridos de usuario y detectar regresiones.",
  },
  d9: {
    label: "Cobertura de aplicaciones móviles",
    description: "Porcentaje del total de aplicaciones que tienen monitoreo móvil.",
    action: "Integre el SDK móvil de Dynatrace (iOS/Android) en sus aplicaciones nativas para tener RUM móvil.",
  },
  d10: {
    label: "Diversidad de ubicaciones de Synthetic",
    description: "Relación entre las ubicaciones sintéticas y el total de monitores sintéticos.",
    action: "Agregue varias ubicaciones sintéticas (públicas y/o privadas) para una cobertura geográfica más amplia.",
  },
  d11: {
    label: "Cobertura de disponibilidad de Synthetic",
    description: "Relación entre monitores sintéticos y aplicaciones web — valida el monitoreo proactivo de la disponibilidad.",
    action: "Cree monitores sintéticos y verifique que se capturen las métricas de disponibilidad de las ejecuciones.",
  },
  d12: {
    label: "Problemas con causa raíz",
    description: "Proporción de problemas de Davis en aplicaciones web y móviles y en monitores sintéticos en las últimas 72 h en los que Davis identificó una entidad de causa raíz.",
    action: "Cierre las brechas de monitoreo en las entidades afectadas para que Davis pueda atribuir una causa raíz; revise los problemas que terminan sin ella.",
  },
  d13: {
    label: "Problemas con respuesta automatizada",
    description: "Proporción de problemas de Davis en aplicaciones web y móviles y en monitores sintéticos en las últimas 72 h que activaron al menos una ejecución de workflow.",
    action: "Cree un workflow activado por problemas que dirija el problema a su responsable (ITSM, chat) o ejecute una remediación preaprobada.",
  },
  d14: {
    label: "Comprobaciones sintéticas ejecutadas por workflows",
    description: "Workflows que ejecutaron una ejecución sintética bajo demanda en las últimas 24 h.",
    action: "Agregue una ejecución sintética bajo demanda a un workflow, por ejemplo para confirmar la recuperación después de un despliegue o de una remediación.",
  },
  d15: {
    label: "Uso de Assist, MCP y dtctl",
    description: "Personas que consultaron sesiones y eventos de usuario mediante Dynatrace Assist, un cliente MCP o la CLI dtctl en los últimos 30 días.",
    action: "Presente Dynatrace Assist al equipo responsable de estos datos y conecte su IDE o agente de programación mediante el servidor MCP de Dynatrace o dtctl.",
  },
  l1: {
    label: "Cobertura de logs de hosts",
    description: "Porcentaje de hosts que enviaron datos de logs en las últimas 2 h.",
    action: "Active la ingesta de logs mediante OneAgent en los hosts. Verifique que los logs a nivel de host estén llegando a Grail.",
  },
  l2: {
    label: "Cobertura de logs de servicios",
    description: "Porcentaje de servicios con datos de logs asociados.",
    action: "Verifique que los datos de logs estén asociados a los servicios. Active la recopilación de logs en los hosts de aplicaciones.",
  },
  l3: {
    label: "Logs correlacionados con traces",
    description: "Porcentaje de registros de log enriquecidos con trace_id.",
    action: "Asegúrese de que trace_id se incluya en la salida de logs. Use el enriquecimiento automático de OneAgent o logging estructurado.",
  },
  l4: {
    label: "Logs enriquecidos con entidades",
    description: "Porcentaje de registros de log enriquecidos con el contexto de la entidad host.",
    action: "Active el enriquecimiento con la entidad host (dt.entity.host) mediante la recopilación de logs de OneAgent u OpenPipeline.",
  },
  l5: {
    label: "Correlación de logs con grupos de procesos",
    description: "Porcentaje de registros de log enriquecidos con el contexto del grupo de procesos.",
    action: "Active el enriquecimiento con grupos de procesos en la configuración de ingesta de logs para el análisis de logs a nivel de servicio.",
  },
  l6: {
    label: "Diversidad de fuentes de logs",
    description: "Relación entre las fuentes de logs distintas y el total de hosts — valida la amplitud de la ingesta de logs en la infraestructura.",
    action: "Agregue fuentes de logs de varias capas (aplicación, infraestructura, K8s, nube). Configure integraciones de logs adicionales.",
  },
  l7: {
    label: "Cobertura de logs de error",
    description: "Porcentaje de servicios cuyos logs incluyen entradas de nivel ERROR.",
    action: "Asegúrese de que los servicios emitan logs de nivel ERROR. Configure reglas de procesamiento de logs para capturar la severidad de error.",
  },
  l8: {
    label: "Cobertura de logs de K8s",
    description: "Porcentaje de namespaces de K8s con datos de logs.",
    action: "Despliegue Dynatrace Operator o Fluent Bit en K8s para capturar los logs de pods y contenedores con metadatos de K8s.",
  },
  l9: {
    label: "Diversidad de severidad de logs",
    description: "Porcentaje de niveles de severidad que se ingestan (de 5: ERROR, WARN, INFO, DEBUG, TRACE).",
    action: "Asegúrese de que las aplicaciones emitan logs en varios niveles de severidad (ERROR, WARN, INFO, DEBUG, TRACE).",
  },
  l12: {
    label: "Logging estructurado",
    description: "Porcentaje de logs con contenido JSON estructurado, que facilita el parseo y el análisis.",
    action: "Configure las aplicaciones para que emitan logs JSON estructurados. Use reglas de procesamiento de OpenPipeline para parsear los logs no estructurados.",
  },
  l13: {
    label: "Logs correlacionados con spans",
    description: "Porcentaje de logs enriquecidos con span_id para una vinculación granular de trace a log (más profunda que con trace_id solo).",
    action: "Configure la autoinstrumentación de OpenTelemetry para inyectar span_id en los logs. En Java use MDC; en .NET use ILogger con el contexto de Activity.",
  },
  l14: {
    label: "Logging de hosts con múltiples fuentes",
    description: "Porcentaje de hosts que reciben logs de 2 o más fuentes distintas — indica una distribución equilibrada de los logs.",
    action: "Active varias fuentes de logs por host: logs de aplicación mediante OneAgent, sistema/syslog, logs de auditoría de seguridad y logs nativos de nube.",
  },
  l15: {
    label: "Eventos basados en logs",
    description: "Presencia de eventos generados a partir de datos de logs — indica que existen alertas basadas en logs.",
    action: "Cree reglas de eventos basados en logs en Settings → Log Events. Defina patrones para errores críticos, seguridad y entradas críticas para el negocio.",
  },
  l16: {
    label: "Enriquecimiento de logs con dispositivos personalizados",
    description: "Porcentaje de logs enriquecidos con entidades de dispositivos personalizados para ampliar el contexto.",
    action: "Registre dispositivos personalizados mediante la API y enriquezca los logs con el atributo dt.entity.custom_device para una correlación específica del dominio.",
  },
  l17: {
    label: "Uso de Assist, MCP y dtctl",
    description: "Personas que consultaron logs mediante Dynatrace Assist, un cliente MCP o la CLI dtctl en los últimos 30 días.",
    action: "Presente Dynatrace Assist al equipo responsable de estos datos y conecte su IDE o agente de programación mediante el servidor MCP de Dynatrace o dtctl.",
  },
  l18: {
    label: "Pipelines de logs personalizados configurados",
    description: "Pipelines de logs que el equipo configuró en OpenPipeline para filtrar, enmascarar, enriquecer o enrutar los logs antes de almacenarlos. Se lee de la configuración, lo que no escanea datos.",
    action: "Cree un pipeline de logs en OpenPipeline para las principales fuentes de logs: enmascare los campos sensibles, descarte el ruido y enrute los registros al bucket correcto.",
  },
  s13: {
    label: "Runtime Vulnerability Analytics activo",
    description: "Informes de estado de vulnerabilidades de Runtime Vulnerability Analytics en las últimas 2 horas.",
    action: "Active Runtime Vulnerability Analytics en la configuración de Application Security.",
  },
  s1: {
    label: "Cobertura de vulnerabilidades en tiempo de ejecución",
    description: "Proporción de grupos de procesos evaluados por Runtime Vulnerability Analytics en las últimas 2 horas.",
    action: "Active Runtime Vulnerability Analytics y asegúrese de que los procesos monitoreados estén cubiertos por las reglas de monitoreo.",
  },
  s2: {
    label: "Hallazgos de seguridad de terceros",
    description: "Herramientas de seguridad externas (escáneres, registros, seguridad de nube) que enviaron hallazgos de vulnerabilidades a Dynatrace en las últimas 24 horas.",
    action: "Ingeste los hallazgos de sus escáneres, registros y herramientas de seguridad de nube para que todas las señales de seguridad queden junto al contexto de ejecución.",
  },
  s11: {
    label: "Runtime Application Protection",
    description: "Detecciones de ataques de Runtime Application Protection en las últimas 24 horas.",
    action: "Active Runtime Application Protection para que los ataques contra código vulnerable se detecten y puedan bloquearse.",
  },
  s12: {
    label: "Security Posture Management",
    description: "Hallazgos de cumplimiento de Security Posture Management en las últimas 2 horas.",
    action: "Active Security Posture Management para evaluar la configuración de Kubernetes y de la nube frente a los estándares de cumplimiento.",
  },
  s14: {
    label: "Uso de Assist, MCP y dtctl",
    description: "Personas que consultaron hallazgos de seguridad mediante Dynatrace Assist, un cliente MCP o la CLI dtctl en los últimos 30 días.",
    action: "Presente Dynatrace Assist al equipo responsable de estos datos y conecte su IDE o agente de programación mediante el servidor MCP de Dynatrace o dtctl.",
  },
  s16: {
    label: "Vulnerabilidades con evaluación de Davis",
    description: "Porcentaje de vulnerabilidades críticas y altas abiertas para las que Davis evaluó si hay activos de datos alcanzables, en las últimas 2 h. Con ese contexto, la vulnerabilidad se prioriza por riesgo real y no solo por severidad.",
    action: "Dé a Davis el contexto para evaluar cada vulnerabilidad: monitoree en full-stack los process groups afectados y las bases de datos que llaman, para conocer los activos de datos alcanzables y la exposición.",
  },
  t4: {
    label: "Hallazgos de detección",
    description: "Detecciones de amenazas que llegaron a Dynatrace en las últimas 24 horas, de cualquier fuente.",
    action: "Envíe las detecciones de amenazas a Dynatrace, desde Runtime Application Protection o desde productos de seguridad externos.",
  },
  t12: {
    label: "Fuentes de detección externas",
    description: "Productos de seguridad distintos de Dynatrace que enviaron detecciones (por ejemplo, detección de amenazas en la nube o protección de endpoints) en las últimas 24 horas.",
    action: "Conecte los productos de detección de amenazas en la nube y de protección de endpoints para que sus detecciones se investiguen con contexto de observabilidad.",
  },
  t13: {
    label: "Workflows de automatización de seguridad",
    description: "Workflows que ejecutaron una acción de seguridad (por ejemplo, enriquecer un observable durante una investigación) en las últimas 24 h.",
    action: "Agregue acciones de seguridad a un workflow, por ejemplo para enriquecer un indicador o abrir un caso cuando llega una detección.",
  },
  t14: {
    label: "Uso de Assist, MCP y dtctl",
    description: "Personas que consultaron hallazgos de seguridad mediante Dynatrace Assist, un cliente MCP o la CLI dtctl en los últimos 30 días.",
    action: "Presente Dynatrace Assist al equipo responsable de estos datos y conecte su IDE o agente de programación mediante el servidor MCP de Dynatrace o dtctl.",
  },
  ai1: {
    label: "Cobertura de servicios con spans de IA",
    description: "Porcentaje de servicios con spans de IA/LLM.",
    action: "Instrumente las llamadas de IA/LLM con las convenciones semánticas gen_ai de OpenTelemetry y expórtelas a Dynatrace.",
  },
  ai2: {
    label: "Cobertura de seguimiento de tokens",
    description: "Porcentaje de spans de IA con seguimiento del uso de tokens.",
    action: "Agregue los atributos de uso de tokens (gen_ai.usage.input_tokens, gen_ai.usage.output_tokens) a los spans de IA.",
  },
  ai19: {
    label: "Modelo de respuesta registrado",
    description: "Porcentaje de spans de IA que registran el modelo que realmente respondió, de modo que se pueda rastrear un cambio de versión del modelo.",
    action: "Registre gen_ai.response.model en cada span de IA, siguiendo las convenciones semánticas GenAI de OpenTelemetry.",
  },
  ai3: {
    label: "Diversidad de proveedores de IA",
    description: "Porcentaje de proveedores de IA conocidos detectados frente a los esperados (de 5).",
    action: "Monitoree varios proveedores de IA. Agregue el atributo gen_ai.system para distinguir los proveedores.",
  },
  ai4: {
    label: "Cobertura de invocaciones de agentes",
    description: "Porcentaje de spans de IA con trazado de invocaciones de agentes.",
    action: "Agregue el atributo gen_ai.agent.name a los spans para el seguimiento de las invocaciones de agentes de IA.",
  },
  ai5: {
    label: "Cobertura de trazado de prompts/respuestas",
    description: "Porcentaje de spans de IA con trazado de prompts o respuestas.",
    action: "Active la captura de prompts y respuestas en los atributos de los spans de IA para auditoría y cumplimiento.",
  },
  ai6: {
    label: "Cobertura de seguimiento de errores de IA",
    description: "Porcentaje de spans de IA con seguimiento del estado de error.",
    action: "Registre los errores de IA estableciendo el estado del span en ERROR ante fallas y tiempos de espera agotados del modelo.",
  },
  ai7: {
    label: "Cobertura de guardrails",
    description: "Porcentaje de spans de IA con monitoreo de guardrails.",
    action: "Implemente el monitoreo de guardrails con atributos gen_ai.guardrail para el cumplimiento de seguridad.",
  },
  ai8: {
    label: "Cobertura de seguimiento de costos",
    description: "Porcentaje de spans de IA que incluyen el conteo de tokens y el modelo, que la aplicación AI Observability necesita para calcular el costo.",
    action: "Envíe el uso de tokens (gen_ai.usage.input_tokens, gen_ai.usage.output_tokens) y el modelo (gen_ai.request.model) en los spans de IA para que la aplicación AI Observability pueda calcular el costo.",
  },
  ai9: {
    label: "Amplitud de servicios con trazado de IA",
    description: "Porcentaje del total de spans que están relacionados con IA.",
    action: "Amplíe la instrumentación de spans de IA para cubrir más servicios y lograr una mayor amplitud del trazado de IA.",
  },
  ai10: {
    label: "Trazado de llamadas a herramientas de agentes",
    description: "Presencia de ejecuciones de herramientas de agentes en los spans de IA (gen_ai.operation.name = execute_tool) en las últimas 72 h.",
    action: "Instrumente los frameworks de agentes con las convenciones GenAI de OpenTelemetry para que las ejecuciones de herramientas aparezcan como spans execute_tool.",
  },
  ai12: {
    label: "IA agéntica en uso",
    description: "Sesiones agénticas de Dynatrace Assist en los últimos 30 días (GENAI_EVENT con skill = operator).",
    action: "Active la IA agéntica para Dynatrace Assist y otorgue ai:operator:execute y los permisos del gateway MCP.",
  },
  ai18: {
    label: "dtctl operado por agentes de IA",
    description: "Personas cuyo agente de programación de IA (por ejemplo, Claude Code) ejecutó dtctl en los últimos 30 días.",
    action: "Dé a los agentes de programación de IA acceso a Dynatrace mediante dtctl o el servidor MCP, bajo el mismo IAM que el usuario.",
  },
  ai14: {
    label: "Workflows agénticos",
    description: "Workflows que consumieron AI Units en los últimos 30 días, como el SRE Agent ejecutándose con un disparador de problemas.",
    action: "Agregue una tarea Run agent (SRE Agent) a un workflow activado por problemas, con una tarea Request Approval antes de las acciones con consecuencias.",
  },
  ai15: {
    label: "Problemas con causa raíz",
    description: "Proporción de problemas de Davis en servicios que llaman a un LLM en las últimas 72 h en los que Davis identificó una entidad de causa raíz.",
    action: "Cierre las brechas de monitoreo en las entidades afectadas para que Davis pueda atribuir una causa raíz; revise los problemas que terminan sin ella.",
  },
  ai16: {
    label: "Problemas con respuesta automatizada",
    description: "Proporción de problemas de Davis en servicios que llaman a un LLM en las últimas 72 h que activaron al menos una ejecución de workflow.",
    action: "Cree un workflow activado por problemas que dirija el problema a su responsable (ITSM, chat) o ejecute una remediación preaprobada.",
  },
  b1: {
    label: "Cobertura de bizevents de servicios",
    description: "Porcentaje de servicios con eventos de negocio asociados.",
    action: "Envíe eventos de negocio a Dynatrace mediante la API de Business Events o la extracción de logs de OpenPipeline.",
  },
  b2: {
    label: "Diversidad de tipos de bizevents",
    description: "Porcentaje de tipos de eventos de negocio esperados que se detectaron (de 10 tipos de referencia).",
    action: "Defina varios tipos de eventos para los distintos procesos de negocio (pedidos, registros, pagos).",
  },
  b3: {
    label: "Eventos con contexto de servicio",
    description: "Porcentaje de eventos de negocio vinculados a servicios.",
    action: "Enriquezca los eventos de negocio con dt.entity.service para correlacionar el impacto en el negocio a nivel de servicio.",
  },
  b4: {
    label: "Diversidad de proveedores de bizevents",
    description: "Porcentaje de proveedores de eventos de negocio esperados que se detectaron (de 5 proveedores de referencia).",
    action: "Agregue el atributo event.provider para clasificar los eventos de negocio según el sistema de origen.",
  },
  b5: {
    label: "Cobertura de datos de ingresos",
    description: "Porcentaje de eventos de negocio con ingresos o valor monetario.",
    action: "Incluya campos de ingresos, importe o valor en los eventos de negocio para el análisis del impacto monetario.",
  },
  b6: {
    label: "Eventos vinculados a sesiones",
    description: "Porcentaje de eventos de negocio vinculados a sesiones de RUM.",
    action: "Vincule los eventos de negocio a las sesiones de RUM incluyendo el atributo dt.rum.session_id.",
  },
  b7: {
    label: "Eventos vinculados a traces",
    description: "Porcentaje de eventos de negocio correlacionados con traces distribuidos.",
    action: "Incluya trace_id en los eventos de negocio para la trazabilidad de las transacciones de extremo a extremo.",
  },
  b9: {
    label: "Problemas con causa raíz",
    description: "Proporción de problemas de Davis en servicios que emiten eventos de negocio en las últimas 72 h en los que Davis identificó una entidad de causa raíz.",
    action: "Cierre las brechas de monitoreo en las entidades afectadas para que Davis pueda atribuir una causa raíz; revise los problemas que terminan sin ella.",
  },
  b10: {
    label: "Problemas con respuesta automatizada",
    description: "Proporción de problemas de Davis en servicios que emiten eventos de negocio en las últimas 72 h que activaron al menos una ejecución de workflow.",
    action: "Cree un workflow activado por problemas que dirija el problema a su responsable (ITSM, chat) o ejecute una remediación preaprobada.",
  },
  b11: {
    label: "Uso de Assist, MCP y dtctl",
    description: "Personas que consultaron eventos de negocio mediante Dynatrace Assist, un cliente MCP o la CLI dtctl en los últimos 30 días.",
    action: "Presente Dynatrace Assist al equipo responsable de estos datos y conecte su IDE o agente de programación mediante el servidor MCP de Dynatrace o dtctl.",
  },
  sd1: {
    label: "Cobertura de despliegues de servicios",
    description: "Porcentaje de servicios con un marcador de despliegue (CUSTOM_DEPLOYMENT) en las últimas 24 h.",
    action: "Active el seguimiento de eventos de despliegue en los servicios. Envíe eventos CUSTOM_DEPLOYMENT desde CI/CD.",
  },
  sd2: {
    label: "Eventos de despliegue de CI/CD",
    description: "Eventos de despliegue de los pipelines de CI/CD en las últimas 24 h (SDLC_EVENT cuyo tipo indica un despliegue).",
    action: "Envíe eventos de despliegue desde CI/CD (Azure DevOps, GitHub, Argo CD) mediante el modelo de eventos SDLC.",
  },
  sd11: {
    label: "Problemas con causa raíz",
    description: "Proporción de problemas de Davis en entidades que recibieron un despliegue en las últimas 72 h en los que Davis identificó una entidad de causa raíz.",
    action: "Cierre las brechas de monitoreo en las entidades afectadas para que Davis pueda atribuir una causa raíz; revise los problemas que terminan sin ella.",
  },
  sd12: {
    label: "Problemas con respuesta automatizada",
    description: "Proporción de problemas de Davis en entidades que recibieron un despliegue en las últimas 72 h que activaron al menos una ejecución de workflow.",
    action: "Cree un workflow activado por problemas que dirija el problema a su responsable (ITSM, chat) o ejecute una remediación preaprobada.",
  },
  sd13: {
    label: "Validación de releases (Site Reliability Guardian)",
    description: "Validaciones de Site Reliability Guardian finalizadas en las últimas 24 h (evento de negocio guardian.validation.finished).",
    action: "Ejecute una validación de Site Reliability Guardian desde el pipeline después de cada despliegue para aprobar o bloquear el release.",
  },
  sd14: {
    label: "Workflows de integración con pipelines",
    description: "Workflows que ejecutaron una acción de control de código fuente o de CI/CD (conectores de GitHub, GitLab, Jenkins, Azure DevOps) en las últimas 24 h.",
    action: "Conecte la herramienta de control de código fuente o de CI/CD a Workflows para que un evento del pipeline pueda iniciar una validación o un rollback.",
  },
  g2: {
    label: "Vigencia de la versión de OneAgent",
    description: "Porcentaje de hosts cuyo OneAgent se compiló en los últimos 12 meses (fecha de compilación leída de la versión instalada).",
    action: "Active las actualizaciones automáticas de OneAgent, o programe las actualizaciones en ventanas de mantenimiento, para que ningún host permanezca en una compilación de más de 12 meses.",
  },
  g4: {
    label: "Logs con contexto de seguridad",
    description: "Porcentaje de registros de log que incluyen dt.security_context, el campo por el que filtran las políticas de acceso a nivel de registro. Se lee de fieldsSnapshot, lo que no escanea datos sin procesar.",
    action: "Defina dt.security_context en las fuentes de logs o en OpenPipeline y luego delimite el acceso con límites de políticas (policy boundaries) sobre ese campo.",
  },
  g5: {
    label: "Éxito de ejecución de workflows",
    description: "Porcentaje de ejecuciones de workflow finalizadas en las últimas 24 h que terminaron con éxito.",
    action: "Revise los workflows que terminan con error, corríjalos o desactívelos, y genere alertas ante ejecuciones fallidas.",
  },
  g6: {
    label: "Integración de ITSM o chat en workflows",
    description: "Workflows que ejecutaron una acción de ServiceNow, Jira, Slack, Microsoft Teams, PagerDuty o correo electrónico en las últimas 24 h.",
    action: "Agregue una acción de ServiceNow, Jira, Slack o Microsoft Teams a los workflows de problemas para que los incidentes lleguen a las herramientas propias del equipo.",
  },
  g8: {
    label: "Aprobación humana en workflows",
    description: "Workflows que ejecutaron una tarea de aprobación en los últimos 7 días, de modo que una persona confirma antes de una acción con consecuencias.",
    action: "Agregue una tarea de aprobación antes de las acciones que modifican producción, para que la automatización de riesgo medio y alto espere a una persona.",
  },
  l11: {
    label: "Buckets de logs dedicados",
    description: "Cantidad de buckets de Grail distintos que contienen datos de logs (se esperan >= 2 para una segregación adecuada). Se lee de fieldsSnapshot, lo que no escanea datos sin procesar.",
    action: "Cree buckets de Grail dedicados para los distintos niveles de logs (seguridad, aplicación, infraestructura). Configure reglas de enrutamiento en OpenPipeline.",
  },
  sd10: {
    label: "Asignación de responsables",
    description: "Porcentaje de servicios con tags de responsable (ownership) asignados — valida el mapeo de responsabilidades de los equipos para la respuesta a incidentes.",
    action: "Asigne tags de responsable (ownership) a los servicios para el mapeo de responsabilidades de los equipos y la respuesta a incidentes.",
  },
  a12: {
    label: "Utilización de tags en servicios",
    description: "Porcentaje de servicios con al menos un tag asignado — los tags permiten el seguimiento de releases, la asignación de responsables y el filtrado.",
    action: "Asigne tags a los servicios para el seguimiento de releases, el mapeo de responsables y el filtrado.",
  },
  g9: {
    label: "Uso de Assist, MCP y dtctl",
    description: "Personas que consultaron eventos de uso de la plataforma, de auditoría y de facturación mediante Dynatrace Assist, un cliente MCP o la CLI dtctl en los últimos 30 días.",
    action: "Presente Dynatrace Assist al equipo responsable de estos datos y conecte su IDE o agente de programación mediante el servidor MCP de Dynatrace o dtctl.",
  },
  g10: {
    label: "SLO definidos",
    description: "Objetivos de nivel de servicio configurados en el entorno, clásicos y de la aplicación Service-Level Objectives. Se lee de la configuración, lo que no escanea datos.",
    action: "Defina un SLO para cada servicio crítico para el negocio, comenzando por la disponibilidad y el tiempo de respuesta.",
  },
  g11: {
    label: "Detectores de anomalías personalizados configurados",
    description: "Detectores de anomalías que el equipo creó sobre sus propias métricas y consultas. Se lee de la configuración, lo que no escanea datos.",
    action: "Cree un detector de anomalías sobre una métrica o consulta DQL que sea relevante para el negocio y que no esté cubierta por la detección integrada.",
  },
  g12: {
    label: "Baselines adaptativos o estacionales en alertas",
    description: "Alertas evaluadas en los últimos 7 días con un baseline autoadaptativo o estacional en lugar de un umbral fijo.",
    action: "Cambie las alertas sobre señales con patrones diarios o semanales de un umbral fijo a un baseline autoadaptativo o estacional.",
  },
  f1: {
    label: "Cálculo de costo y carbono en ejecución",
    description: "Workflows que ejecutaron el cálculo de Cost & Carbon Optimization en las últimas 24 h.",
    action: "Instale Cost & Carbon Optimization desde el Hub y programe su workflow de cálculo.",
  },
  f2: {
    label: "Hosts con medición de carbono",
    description: "Porcentaje de hosts con una medición de energía y carbono de Cost & Carbon Optimization en las últimas 6 h.",
    action: "Compruebe que el cálculo cubra todos los hosts monitoreados; los hosts sin medición suelen estar fuera del alcance del workflow.",
  },
  f3: {
    label: "Gasto de nube ingestado",
    description: "Proveedores de nube cuyos datos de facturación (formato FOCUS) se importaron a Cost & Carbon Optimization en las últimas 30 horas (la importación se ejecuta una vez al día).",
    action: "Configure la importación de costos de nube en Cost & Carbon Optimization para que la exportación de facturación FOCUS del proveedor se cargue a diario.",
  },
  f4: {
    label: "Gasto de nube con responsable",
    description: "Proporción del costo de nube importado cuyos tags de facturación indican un responsable o un centro de costos.",
    action: "Etiquete los recursos de nube con un responsable o un centro de costos en el proveedor, para que el costo importado pueda atribuirse.",
  },
  f5: {
    label: "Namespaces de Kubernetes con medición de carbono",
    description: "Porcentaje de namespaces de Kubernetes con una medición de energía y carbono en las últimas 6 h.",
    action: "Incluya los clusters de Kubernetes en el cálculo de carbono para que cada namespace tenga su propia medición.",
  },
  f6: {
    label: "Hosts en uso activo",
    description: "Porcentaje de hosts medidos cuyo uso promedio de CPU en las últimas 6 h es igual o superior al 3%, el umbral de inactividad que aplica Cost & Carbon Optimization.",
    action: "Revise los hosts por debajo del umbral de inactividad: detenga, consolide o reduzca el tamaño de los que no sean necesarios.",
  },
  f7: {
    label: "Gasto con descuento por compromiso",
    description: "Proporción del costo de nube importado que está cubierta por un descuento por compromiso (plan de ahorro o capacidad reservada).",
    action: "Revise los workloads estables que se pagan bajo demanda y evalúe un descuento por compromiso con el proveedor de nube.",
  },
  f8: {
    label: "Energía en uso productivo",
    description: "Proporción de la energía medida en los hosts en las últimas 6 h que no se clasificó como desperdiciada (CPU inactiva y su sobrecarga).",
    action: "Ajuste el tamaño de los hosts con bajo uso de CPU; la energía desperdiciada proviene de la capacidad que permanece inactiva.",
  },
  g3: {
    label: "Costo de monitoreo de hosts asignado",
    description: "Porcentaje de registros de facturación de monitoreo de hosts en las últimas 24 h que incluyen un centro de costos (dt.cost.costcenter).",
    action: "Defina dt.cost.costcenter en los hosts (propiedades del host o labels de Kubernetes) para que el uso de monitoreo de hosts se asigne a un centro de costos.",
  },
  b8: {
    label: "Eventos de negocio con centro de costos",
    description: "Porcentaje de eventos de negocio con datos de centro de costos o de producto.",
    action: "Agregue los atributos dt.cost.costcenter y dt.cost.product para correlacionar FinOps con el negocio.",
  },
};
