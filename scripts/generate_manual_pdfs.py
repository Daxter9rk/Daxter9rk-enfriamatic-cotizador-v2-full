"""Generate the two public V2.1 role manuals from an editable source."""

from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "manuales"
VERSION = "V2.1 - Entorno DEV"

COMMON = [
    ("Acceso y recuperación", ["Usa únicamente tu cuenta individual.", "No compartas contraseñas ni códigos.", "Solicita recuperación de acceso al administrador autorizado."]),
    ("Clientes, instalaciones y equipos", ["Registra el cliente antes de su instalación.", "Completa ubicación, acceso y contacto del sitio.", "Vincula cada equipo y conserva su expediente técnico."]),
    ("Solicitudes", ["Crea o abre una solicitud trazable.", "Asigna un responsable activo.", "Avanza Pendiente, Asignada, En progreso y Completada; Cancelada es terminal."]),
    ("Cotizaciones y PDF", ["Crea el borrador desde una solicitud válida.", "Revisa partidas, descuentos, IVA y total.", "Al emitir se asigna folio, se genera un PDF privado y se bloquea el original."]),
    ("Corrección de una emitida", ["Nunca desbloquees ni edites la cotización emitida.", "Crea una corrección para obtener nueva solicitud, borrador y folio.", "Conserva la referencia al documento original."]),
    ("Actividad y notificaciones", ["Usa filtros para localizar el evento.", "Abre la notificación y navega al recurso relacionado.", "No compartas identificadores técnicos fuera del equipo autorizado."]),
    ("Soporte", ["Abre Manual / Soporte.", "Describe módulo, impacto y pasos observados sin incluir secretos.", "Copia la información técnica no sensible cuando ayude al diagnóstico."]),
]

ADMIN = [
    ("Usuarios y seguridad", ["Sólo el administrador principal promueve o degrada administradores.", "Confirma y reautentica los cambios sensibles.", "Nunca desactives tu propia cuenta ni al último administrador activo."]),
    ("Configuración segura", ["La pantalla inicia en modo de sólo lectura.", "Pulsa Editar, revisa el resumen y confirma tu identidad.", "Los cambios de empresa, IVA y vigencia quedan auditados."]),
] + COMMON

OPERATOR = [
    ("Alcance del operador", ["Consulta únicamente recursos asignados.", "Registra notas e intervenciones con datos reales.", "Solicita al administrador los cambios de identidad, configuración o datos maestros."]),
] + COMMON


def footer(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D9E5F2"))
    canvas.line(18 * mm, 16 * mm, 198 * mm, 16 * mm)
    canvas.setFillColor(colors.HexColor("#52637A"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 10 * mm, f"Enfriamatic Cotizador {VERSION}")
    canvas.drawRightString(198 * mm, 10 * mm, f"Página {document.page}")
    canvas.restoreState()


def generate(role, sections, filename):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("TitleBlue", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=25, leading=30, textColor=colors.HexColor("#082C73"), alignment=TA_CENTER, spaceAfter=14)
    subtitle = ParagraphStyle("Subtitle", parent=styles["BodyText"], fontSize=11, leading=16, textColor=colors.HexColor("#52637A"), alignment=TA_CENTER)
    heading = ParagraphStyle("HeadingBlue", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=colors.HexColor("#0B55D9"), spaceBefore=10, spaceAfter=7)
    body = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=10, leading=15, textColor=colors.HexColor("#17233B"), leftIndent=8)
    doc = SimpleDocTemplate(str(OUTPUT / filename), pagesize=letter, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=20 * mm, bottomMargin=22 * mm, title=f"Manual del {role} V2.1", author="Enfriamatic")
    story = [Spacer(1, 16 * mm), Paragraph("ENFRIAMATIC", title), Paragraph(f"Manual del {role}", title), Paragraph("Guía visual y operativa para Enfriamatic Cotizador V2.1", subtitle), Spacer(1, 10 * mm), Paragraph("Documento de apoyo para entorno DEV. No contiene credenciales ni datos de clientes.", subtitle), PageBreak()]
    story += [Paragraph("Índice", title)]
    for index, (name, _) in enumerate(sections, 1):
        story.append(Paragraph(f"{index}. {name}", body))
    story.append(PageBreak())
    for index, (name, steps) in enumerate(sections, 1):
        story.append(Paragraph(f"{index}. {name}", heading))
        for step_index, step in enumerate(steps, 1):
            story.append(Paragraph(f"<b>{step_index}</b>&nbsp;&nbsp;{step}", body))
            story.append(Spacer(1, 2 * mm))
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    generate("administrador", ADMIN, "manual-administrador-v2.1.pdf")
    generate("operador", OPERATOR, "manual-operador-v2.1.pdf")
