# Agenda Clara WhatsApp

Demo para mostrar a peluquerias como funcionaria una recepcion por WhatsApp que responde consultas y deja reservas listas para confirmar.

## Enfoque de la demo

- Nombre comercial: `Agenda Clara WhatsApp`.
- Frase guia: `Tu WhatsApp atendiendo mientras tu equipo esta con una clienta`.
- Tono: cercano, simple y de recepcion, no tecnico.
- Promesa: menos mensajes perdidos y una lista clara de reservas por confirmar.
- Formato visual: herramienta de recepcion, no landing page ni mockup generico.

## Que muestra

- Chat simulado con tono de recepcion.
- Preguntas frecuentes sobre precios, horario y ubicacion.
- Flujo de solicitud de reserva con nombre, servicio, dia, horario y telefono.
- Panel interno de solicitudes pendientes, confirmadas o cerradas.
- Copia de resumen y descarga CSV para llevar los datos a Sheets, Notion o CRM.
- Ficha editable del salon para personalizar la conversacion durante la demo.

## Como probar en GitHub Pages

Abrir `agenda-clara/index.html` desde GitHub Pages.

La version publicada funciona en modo demo sin backend para que un cliente pueda probarla sin instalar nada.

## Como probar con backend local

Primero levantar el backend:

```bash
cd ../whatsapp-reservas-api
npm start
```

Luego abrir `index.html` en el navegador.

La demo local se conecta a:

```text
http://localhost:3333
```

## Alcance del MVP

Esta version no envia mensajes reales por WhatsApp. En GitHub Pages usa un modo demo autonomo; localmente puede usar el backend para responder, mantener estado de conversacion y registrar solicitudes.
