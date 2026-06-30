#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Generador del manual PDF del Panel de Servicios El Desembarco."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black, Color
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    Flowable, KeepTogether, ListFlowable, ListItem
)
from reportlab.graphics.shapes import (
    Drawing, Rect, Line, String, Polygon, Circle, Path, Group
)
from reportlab.pdfgen import canvas

# ===== Colores Desembarco =====
ORANGE  = HexColor('#c8422b')
ORANGE_LIGHT = HexColor('#f5d8cf')
ORANGE_DARK = HexColor('#9c331f')
INK     = HexColor('#1a1a1a')
INK2    = HexColor('#555555')
INK3    = HexColor('#888888')
BG      = HexColor('#fafafa')
BG_DARK = HexColor('#0e0e0e')
LINE    = HexColor('#e0e0e0')
LINE_DARK = HexColor('#2a2a2a')
GREEN   = HexColor('#2d7a4d')
GREEN_LIGHT = HexColor('#d3f0dd')
RED     = HexColor('#c43a3a')
RED_LIGHT = HexColor('#f5d3d3')
WARN    = HexColor('#d97706')
WARN_LIGHT = HexColor('#fde6c4')
BLUE    = HexColor('#2563eb')

PAGE_W, PAGE_H = A4
MARGIN = 1.8 * cm
CONTENT_W = PAGE_W - 2 * MARGIN

# ===== Estilos =====
styles = getSampleStyleSheet()

style_title = ParagraphStyle(
    'TitleHero', parent=styles['Title'],
    fontName='Helvetica-Bold', fontSize=32, textColor=INK,
    leading=38, spaceAfter=4, alignment=TA_LEFT,
)
style_subtitle = ParagraphStyle(
    'Subtitle', parent=styles['Title'],
    fontName='Helvetica-Oblique', fontSize=18, textColor=ORANGE,
    leading=22, alignment=TA_LEFT, spaceAfter=20,
)
style_h1 = ParagraphStyle(
    'H1', parent=styles['Heading1'],
    fontName='Helvetica-Bold', fontSize=22, textColor=INK,
    leading=26, spaceBefore=10, spaceAfter=8, alignment=TA_LEFT,
)
style_h2 = ParagraphStyle(
    'H2', parent=styles['Heading2'],
    fontName='Helvetica-Bold', fontSize=15, textColor=ORANGE,
    leading=18, spaceBefore=14, spaceAfter=6,
)
style_h3 = ParagraphStyle(
    'H3', parent=styles['Heading3'],
    fontName='Helvetica-Bold', fontSize=12, textColor=INK,
    leading=14, spaceBefore=8, spaceAfter=4,
)
style_body = ParagraphStyle(
    'Body', parent=styles['BodyText'],
    fontName='Helvetica', fontSize=10, textColor=INK2,
    leading=14, spaceAfter=6, alignment=TA_LEFT,
)
style_caption = ParagraphStyle(
    'Caption', parent=styles['BodyText'],
    fontName='Helvetica-Oblique', fontSize=9, textColor=INK3,
    leading=11, alignment=TA_CENTER, spaceBefore=4, spaceAfter=10,
)
style_code = ParagraphStyle(
    'Code', parent=styles['Code'],
    fontName='Courier', fontSize=9, textColor=INK,
    leading=12, leftIndent=8, rightIndent=8,
    backColor=BG, borderPadding=6, borderColor=LINE,
    borderWidth=0.5, spaceBefore=6, spaceAfter=8,
)
style_callout = ParagraphStyle(
    'Callout', parent=style_body,
    fontSize=10, textColor=INK,
    backColor=ORANGE_LIGHT, borderPadding=10, borderColor=ORANGE,
    borderWidth=0.5, leading=14,
    spaceBefore=8, spaceAfter=10,
)
style_pillaccent = ParagraphStyle(
    'Pill', parent=style_body, fontSize=8, textColor=ORANGE,
    backColor=ORANGE_LIGHT, borderPadding=3, leading=10,
)


# ===== Helpers de wireframes =====

class Wireframe(Flowable):
    """Flowable que dibuja un wireframe SVG-like."""
    def __init__(self, width, height, draw_fn, caption=None):
        self.width = width
        self.height = height
        self.draw_fn = draw_fn
        self.caption = caption
    def wrap(self, *args):
        return (self.width, self.height + (16 if self.caption else 0))
    def draw(self):
        c = self.canv
        c.saveState()
        # Caja con borde sutil
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.setFillColor(white)
        c.roundRect(0, 0, self.width, self.height, 6, stroke=1, fill=1)
        # Llamar al draw custom
        self.draw_fn(c, self.width, self.height)
        c.restoreState()
        if self.caption:
            c.setFont('Helvetica-Oblique', 8)
            c.setFillColor(INK3)
            c.drawCentredString(self.width / 2, -12, self.caption)


def fill_rect(c, x, y, w, h, color, radius=0):
    c.setFillColor(color)
    c.setStrokeColor(color)
    if radius:
        c.roundRect(x, y, w, h, radius, stroke=0, fill=1)
    else:
        c.rect(x, y, w, h, stroke=0, fill=1)

def stroke_rect(c, x, y, w, h, color, line_width=0.5, radius=0, fill=None):
    c.setStrokeColor(color)
    c.setLineWidth(line_width)
    if fill:
        c.setFillColor(fill)
    if radius:
        c.roundRect(x, y, w, h, radius, stroke=1, fill=1 if fill else 0)
    else:
        c.rect(x, y, w, h, stroke=1, fill=1 if fill else 0)

def label(c, x, y, text, size=8, color=INK, font='Helvetica'):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x, y, text)

def label_centered(c, x, y, text, size=8, color=INK, font='Helvetica'):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawCentredString(x, y, text)


# ===== Wireframe: Login =====
def draw_login(c, w, h):
    # Fondo
    fill_rect(c, 0, 0, w, h, BG_DARK)
    # Card login centrada
    cw, ch = 220, 200
    cx, cy = (w - cw) / 2, (h - ch) / 2
    fill_rect(c, cx, cy, cw, ch, HexColor('#181818'), radius=10)
    stroke_rect(c, cx, cy, cw, ch, LINE_DARK, radius=10)
    # Letra D logo
    c.setFillColor(ORANGE)
    c.circle(cx + 30, cy + ch - 30, 12, fill=1, stroke=0)
    label(c, cx + 26, cy + ch - 33, 'D', size=14, color=white, font='Helvetica-Bold')
    label(c, cx + 50, cy + ch - 28, 'Desembarco', size=11, color=white, font='Helvetica-Bold')
    label(c, cx + 50, cy + ch - 38, 'Panel de Servicios · IA', size=7, color=INK3)
    # Title
    label(c, cx + 16, cy + ch - 70, 'Acceso restringido', size=11, color=white, font='Helvetica-Bold')
    label(c, cx + 16, cy + ch - 84, 'Iniciá sesión con tu cuenta corporativa', size=8, color=INK3)
    # Botón Google
    bx, by, bw, bh = cx + 16, cy + 60, cw - 32, 28
    fill_rect(c, bx, by, bw, bh, white, radius=4)
    label(c, bx + 18, by + 9, 'G', size=12, color=BLUE, font='Helvetica-Bold')
    label(c, bx + 36, by + 9, 'Continuar con Google', size=10, color=INK, font='Helvetica-Bold')
    # Foot
    label(c, cx + 16, cy + 24, 'Solo cuentas @eldesembarco.com', size=7, color=INK3)


# ===== Wireframe: Layout general (sidebar + topbar + main) =====
def draw_app_layout(c, w, h):
    # Sidebar
    sidebar_w = 95
    fill_rect(c, 0, 0, sidebar_w, h, HexColor('#0a0a0a'))
    # Marca
    c.setFillColor(ORANGE)
    c.circle(15, h - 18, 7, fill=1, stroke=0)
    label(c, 12, h - 21, 'D', size=8, color=white, font='Helvetica-Bold')
    label(c, 26, h - 16, 'Desembarco', size=8, color=white, font='Helvetica-Bold')
    label(c, 26, h - 24, 'Servicios · IA', size=6, color=INK3)
    # Nav items
    nav_items = [
        ('Panel servicios', False),
        ('Planilla', True),
        ('Nuevas facturas', False),
        ('Locales', False),
        ('Vencidos', False),
        ('Calendario', False),
        ('Ingesta IA', False),
        ('Revisión', False),
        ('Reportes', False),
        ('Alertas', False),
    ]
    y = h - 50
    for name, active in nav_items:
        if active:
            fill_rect(c, 6, y - 10, sidebar_w - 12, 18, HexColor('#222'), radius=3)
        c.setFillColor(white if active else INK3)
        c.setFont('Helvetica' + ('-Bold' if active else ''), 7)
        c.drawString(14, y - 4, name)
        y -= 22
    # Footer user
    fill_rect(c, 6, 8, sidebar_w - 12, 32, HexColor('#161616'), radius=4)
    c.setFillColor(ORANGE)
    c.circle(16, 24, 7, fill=1, stroke=0)
    label(c, 13, 21, 'S', size=8, color=white, font='Helvetica-Bold')
    label(c, 28, 27, 'Sistemas', size=7, color=white, font='Helvetica-Bold')
    label(c, 28, 19, 'usuario@', size=5, color=INK3)
    label(c, 28, 13, 'eldesembarco.com', size=5, color=INK3)
    # Topbar
    tb_y = h - 28
    fill_rect(c, sidebar_w, tb_y, w - sidebar_w, 28, white)
    c.setStrokeColor(LINE)
    c.line(sidebar_w, tb_y, w, tb_y)
    # Search box
    sx = sidebar_w + 220
    stroke_rect(c, sx, tb_y + 6, 130, 16, LINE, radius=4)
    label(c, sx + 8, tb_y + 12, '🔍 Buscar local, servicio…', size=6, color=INK3)
    # Buttons
    stroke_rect(c, sx + 138, tb_y + 6, 16, 16, LINE, radius=3)
    label(c, sx + 142, tb_y + 12, '↻', size=8, color=INK)
    stroke_rect(c, sx + 158, tb_y + 6, 16, 16, LINE, radius=3)
    label(c, sx + 163, tb_y + 12, '☾', size=8, color=INK)
    fill_rect(c, sx + 178, tb_y + 6, 70, 16, ORANGE, radius=3)
    label(c, sx + 184, tb_y + 12, '+ Nueva factura', size=6, color=white, font='Helvetica-Bold')
    # User badge
    stroke_rect(c, w - 60, tb_y + 6, 50, 16, LINE, radius=3)
    c.setFillColor(ORANGE)
    c.circle(w - 53, tb_y + 14, 5, fill=1, stroke=0)
    label(c, w - 46, tb_y + 12, 'Sistemas ▾', size=6, color=INK)
    # Main area placeholder
    label(c, sidebar_w + 18, tb_y - 24, 'Planilla de servicios', size=11, color=INK, font='Helvetica-Bold')
    label(c, sidebar_w + 18, tb_y - 36, '218 registros · 12 vencidos · 32 deuda · 174 pagos', size=6, color=INK3)
    # Tabla mock
    table_y = tb_y - 56
    headers = ['Local', 'Servicio', 'Monto', 'Vencimiento', 'Estado', 'F. Pago', 'Forma']
    col_widths = [55, 60, 50, 55, 45, 50, 55]
    x = sidebar_w + 18
    for i, hd in enumerate(headers):
        fill_rect(c, x, table_y, col_widths[i], 16, BG)
        stroke_rect(c, x, table_y, col_widths[i], 16, LINE)
        label(c, x + 4, table_y + 5, hd, size=6, color=INK2, font='Helvetica-Bold')
        x += col_widths[i]
    # Filas mock
    rows = [
        ['Boedo',     'Edenor',     '$ 38.420', '05/05/2026', 'DEUDA',   '—',           'Déb. autom.'],
        ['Devoto',    'Naturgy',    '$ 12.180', '02/05/2026', 'VENCIDO', '—',           'Transferencia'],
        ['Microcentro','Telecentro','$ 24.500', '12/05/2026', 'PAGO',    '28/04/2026',  'Tarjeta'],
        ['Ramos',     'Aysa',       '$  8.640', '15/05/2026', 'DEUDA',   '—',           '—'],
    ]
    estado_colors = {'DEUDA': WARN, 'VENCIDO': RED, 'PAGO': GREEN}
    estado_bg = {'DEUDA': WARN_LIGHT, 'VENCIDO': RED_LIGHT, 'PAGO': GREEN_LIGHT}
    for ri, row in enumerate(rows):
        x = sidebar_w + 18
        ry = table_y - 16 - ri * 16
        for i, val in enumerate(row):
            stroke_rect(c, x, ry, col_widths[i], 16, LINE)
            if headers[i] == 'Estado':
                ec = estado_colors[val]
                fill_rect(c, x + 4, ry + 4, col_widths[i] - 8, 8, estado_bg[val], radius=4)
                c.setFillColor(ec)
                c.circle(x + 9, ry + 8, 1.5, fill=1, stroke=0)
                label(c, x + 14, ry + 6, val, size=5, color=ec, font='Helvetica-Bold')
            else:
                label(c, x + 4, ry + 5, val, size=6, color=INK)
            x += col_widths[i]


# ===== Wireframe: Pipeline de ingesta =====
def draw_pipeline(c, w, h):
    fill_rect(c, 0, 0, w, h, BG)
    # Etapas
    stages = [
        ('Casillas\nconfiguradas', 'Reciben emails con\nfacturas adjuntas', INK2),
        ('Apps Script', 'Filtra: capa 1\nheurística + capa 2\nGemini Flash', BLUE),
        ('Drive folder', 'Sube los PDFs\nque pasaron filtro', GREEN),
        ('n8n procesador', 'Gemini Vision lee\nel PDF · matchea\nlocal + servicio', ORANGE),
        ('Google Sheet\n(Facturas)', 'Factura registrada\ncon auditoría', INK),
    ]
    n = len(stages)
    box_w = (w - 40 - (n - 1) * 18) / n
    box_h = h - 40
    for i, (title, desc, color) in enumerate(stages):
        x = 20 + i * (box_w + 18)
        y = 20
        # Box
        fill_rect(c, x, y, box_w, box_h, white, radius=8)
        stroke_rect(c, x, y, box_w, box_h, color, line_width=1.5, radius=8)
        # Header bar
        fill_rect(c, x, y + box_h - 24, box_w, 24, color, radius=8)
        fill_rect(c, x, y + box_h - 24, box_w, 12, color)  # tapa esquinas inferiores
        # Title
        for li, line in enumerate(title.split('\n')):
            label_centered(c, x + box_w / 2, y + box_h - 14 - li * 8, line,
                          size=8, color=white, font='Helvetica-Bold')
        # Desc
        for li, line in enumerate(desc.split('\n')):
            label_centered(c, x + box_w / 2, y + box_h - 40 - li * 9, line,
                          size=7, color=INK2)
        # Flecha al siguiente
        if i < n - 1:
            ax = x + box_w + 2
            ay = y + box_h / 2
            c.setStrokeColor(INK3)
            c.setLineWidth(1)
            c.line(ax, ay, ax + 12, ay)
            c.setFillColor(INK3)
            p = c.beginPath()
            p.moveTo(ax + 12, ay - 4)
            p.lineTo(ax + 16, ay)
            p.lineTo(ax + 12, ay + 4)
            p.close()
            c.drawPath(p, fill=1, stroke=0)


# ===== Wireframe: Drop overlay (drag PDF) =====
def draw_dropzone(c, w, h):
    fill_rect(c, 0, 0, w, h, HexColor('#1a0e0a'))
    # Caja de drop
    cw, ch = 280, 140
    cx, cy = (w - cw) / 2, (h - ch) / 2
    fill_rect(c, cx, cy, cw, ch, HexColor('#181818'), radius=14)
    # Borde dashed
    c.setStrokeColor(ORANGE)
    c.setDash(4, 3)
    c.setLineWidth(1.5)
    c.roundRect(cx, cy, cw, ch, 14, stroke=1, fill=0)
    c.setDash()
    # Icon
    c.setFillColor(ORANGE_LIGHT)
    c.circle(cx + cw / 2, cy + ch - 36, 18, fill=1, stroke=0)
    label_centered(c, cx + cw / 2, cy + ch - 39, '↑', size=20, color=ORANGE, font='Helvetica-Bold')
    label_centered(c, cx + cw / 2, cy + ch - 70, 'Soltá el PDF acá', size=14, color=white, font='Helvetica-Bold')
    label_centered(c, cx + cw / 2, cy + ch - 86, 'La IA lo lee, matchea local + servicio y lo registra', size=8, color=INK3)


# ===== Wireframe: Detalle de factura =====
def draw_factura_detail(c, w, h):
    fill_rect(c, 0, 0, w, h, BG)
    # Sidebar drawer (derecha)
    dw = w * 0.55
    dx = w - dw
    fill_rect(c, dx, 0, dw, h, white)
    c.setStrokeColor(LINE)
    c.line(dx, 0, dx, h)
    # Header
    label(c, dx + 14, h - 22, 'ENERGÍA', size=6, color=ORANGE, font='Helvetica-Bold')
    fill_rect(c, dx + 70, h - 26, 36, 12, GREEN_LIGHT, radius=6)
    label(c, dx + 75, h - 22, '● PAGO', size=6, color=GREEN, font='Helvetica-Bold')
    label(c, dx + 14, h - 42, 'Edenor', size=14, color=INK, font='Helvetica-Bold')
    label(c, dx + 14, h - 56, 'Boedo · 2026-04', size=8, color=INK3)
    # Monto card
    cy = h - 110
    stroke_rect(c, dx + 14, cy, dw - 28, 44, GREEN, radius=6)
    label(c, dx + 22, cy + 30, 'MONTO', size=6, color=INK3, font='Helvetica-Bold')
    label(c, dx + 22, cy + 12, '$ 38.420,00', size=16, color=INK, font='Helvetica-Bold')
    # Fields
    fields = [
        ('Vencimiento',  '05/05/2026'),
        ('Fecha de pago','28/04/2026'),
        ('Forma de pago','Tarjeta de Crédito'),
        ('N° cliente',   '12345678901'),
        ('Titular',      'El Desembarco SA'),
    ]
    fy = cy - 14
    for k, v in fields:
        label(c, dx + 14, fy, k, size=6, color=INK3, font='Helvetica-Bold')
        label(c, dx + dw - 14 - len(v) * 4, fy, v, size=7, color=INK, font='Courier')
        c.setStrokeColor(LINE)
        c.line(dx + 14, fy - 4, dx + dw - 14, fy - 4)
        fy -= 16
    # Auditoría block
    fy -= 10
    label(c, dx + 14, fy, '👤 AUDITORÍA', size=7, color=INK, font='Helvetica-Bold')
    fy -= 14
    label(c, dx + 14, fy, 'Creada por', size=6, color=INK3, font='Helvetica-Bold')
    fill_rect(c, dx + dw - 100, fy - 4, 86, 12, ORANGE_LIGHT, radius=6)
    label(c, dx + dw - 96, fy, '✦ IA · automático', size=6, color=ORANGE, font='Helvetica-Bold')
    fy -= 14
    label(c, dx + 14, fy, 'Última edición', size=6, color=INK3, font='Helvetica-Bold')
    label(c, dx + dw - 110, fy, 'usuario@eldesembarco.com', size=6, color=INK, font='Courier')
    # Footer buttons
    stroke_rect(c, dx + 14, 14, 80, 22, LINE, radius=4)
    label(c, dx + 26, 22, '↗ Ir al portal', size=7, color=INK)
    fill_rect(c, dx + 100, 14, 100, 22, ORANGE, radius=4)
    label(c, dx + 116, 22, '✓ Registrar pago', size=7, color=white, font='Helvetica-Bold')


# ===== Wireframe: Calendario / Heatmap =====
def draw_heatmap(c, w, h):
    fill_rect(c, 0, 0, w, h, white)
    label(c, 12, h - 18, 'Año 2026 · Densidad de vencimientos', size=9, color=INK, font='Helvetica-Bold')
    # Días de la semana
    dlabels = ['Lun', 'Mié', 'Vie']
    grid_x = 36
    grid_y = h - 50
    for i, dl in enumerate(['Lun','','Mié','','Vie','','Dom']):
        if dl:
            label(c, 8, grid_y - i * 7 + 3, dl, size=5, color=INK3)
    # Cells
    import random
    random.seed(7)
    for week in range(53):
        for day in range(7):
            x = grid_x + week * 7
            y = grid_y - day * 7
            r = random.random()
            if r < 0.5:
                color = HexColor('#ebebeb')
            elif r < 0.7:
                color = HexColor('#f5d8cf')
            elif r < 0.85:
                color = HexColor('#e5836f')
            elif r < 0.95:
                color = HexColor('#d4502d')
            else:
                color = ORANGE_DARK
            fill_rect(c, x, y, 5.5, 5.5, color, radius=1)
    # Meses
    months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    for i, m in enumerate(months):
        label(c, grid_x + i * 31, h - 35, m, size=5, color=INK3)
    # Legend
    label(c, grid_x, 14, 'Menos', size=5, color=INK3)
    legend_x = grid_x + 30
    for i, col in enumerate(['#ebebeb','#f5d8cf','#e5836f','#d4502d','#9c331f']):
        fill_rect(c, legend_x + i * 8, 14, 6, 6, HexColor(col), radius=1)
    label(c, legend_x + 5 * 8 + 4, 14, 'Más', size=5, color=INK3)


# ===== Wireframe: Reportes (KPIs) =====
def draw_reportes(c, w, h):
    fill_rect(c, 0, 0, w, h, BG)
    # 4 KPIs en grid
    kpis = [
        ('FACTURADO', '$ 1.847.220', '+12% vs mes ant.', None),
        ('PAGADO', '$ 1.123.480', '60% del total', GREEN),
        ('DEUDA VIVA', '$ 723.740', '$ 213.500 vencido', RED),
        ('SERVICIOS PAGOS', '187/312', '60% del mes', GREEN),
    ]
    kw = (w - 40) / 4
    kh = 56
    ky = h - 76
    for i, (lbl, val, sub, accent) in enumerate(kpis):
        kx = 12 + i * (kw + 4)
        fill_rect(c, kx, ky, kw, kh, white, radius=6)
        stroke_rect(c, kx, ky, kw, kh, LINE, radius=6)
        if accent:
            fill_rect(c, kx, ky + kh - 3, kw, 3, accent, radius=0)
        label(c, kx + 8, ky + kh - 14, lbl, size=6, color=INK3, font='Helvetica-Bold')
        label(c, kx + 8, ky + kh - 32, val, size=11, color=INK, font='Helvetica-Bold')
        label(c, kx + 8, ky + 8, sub, size=6, color=INK3)
    # Bar chart por categoría
    label(c, 12, ky - 16, 'Gasto por categoría', size=9, color=INK, font='Helvetica-Bold')
    cats = [('Energía', 0.95, ORANGE), ('Gas', 0.62, BLUE), ('Conectividad', 0.48, GREEN),
            ('Agua', 0.32, HexColor('#06b6d4')), ('Impuestos', 0.45, WARN),
            ('Inmueble', 0.85, HexColor('#7c3aed'))]
    bx = 12
    by = ky - 32
    bar_h = 8
    for nm, ratio, col in cats:
        label(c, bx, by + 2, nm, size=6, color=INK2)
        fill_rect(c, bx + 60, by, 200, bar_h, BG)
        fill_rect(c, bx + 60, by, 200 * ratio, bar_h, col, radius=2)
        label(c, bx + 270, by + 2, f'{int(ratio*100)}%', size=6, color=INK)
        by -= 12


# ===== Wireframe: Drawer ingesta IA con uploads =====
def draw_ingesta(c, w, h):
    fill_rect(c, 0, 0, w, h, BG)
    # Title
    label(c, 14, h - 18, 'Ingesta IA', size=12, color=INK, font='Helvetica-Bold')
    label(c, 14, h - 30, 'Tirá un PDF acá o en cualquier pantalla del panel.', size=7, color=INK3)
    # Dropzone compacta
    fill_rect(c, 14, h - 80, w - 28, 40, white, radius=8)
    c.setStrokeColor(ORANGE)
    c.setDash(3, 3)
    c.setLineWidth(1)
    c.roundRect(14, h - 80, w - 28, 40, 8, stroke=1, fill=0)
    c.setDash()
    # Icon
    fill_rect(c, 26, h - 72, 22, 22, ORANGE_LIGHT, radius=5)
    label_centered(c, 37, h - 65, '↑', size=13, color=ORANGE, font='Helvetica-Bold')
    label(c, 56, h - 60, 'Arrastrá un PDF', size=9, color=INK, font='Helvetica-Bold')
    label(c, 56, h - 70, 'o hacé click para elegir desde tu computadora', size=6, color=INK3)
    fill_rect(c, w - 90, h - 70, 70, 22, ORANGE, radius=4)
    label(c, w - 80, h - 62, '+ Elegir PDF', size=7, color=white, font='Helvetica-Bold')
    # Subidas recientes
    label(c, 14, h - 100, 'SUBIDAS RECIENTES', size=6, color=INK3, font='Helvetica-Bold')
    rows = [
        ('factura_edenor_boedo.pdf', 'Factura creada · → Edenor · Boedo', GREEN, '✓'),
        ('comprobante_pago.pdf',     'Pago registrado · → Naturgy · Devoto', GREEN, '✓'),
        ('escan_gas_marzo.pdf',      'Probable Revisión · chequeá ahí', WARN, '✦'),
        ('boleta_aysa.pdf',          'Subiendo… 64%', ORANGE, '↑'),
    ]
    ry = h - 116
    for fname, msg, color, icon in rows:
        fill_rect(c, 14, ry - 18, w - 28, 22, white, radius=4)
        stroke_rect(c, 14, ry - 18, w - 28, 22, color, radius=4, line_width=1)
        # Icon box
        fill_rect(c, 18, ry - 14, 14, 14, color, radius=3)
        label_centered(c, 25, ry - 11, icon, size=8, color=white, font='Helvetica-Bold')
        # Name + msg
        label(c, 36, ry - 6, fname, size=7, color=INK, font='Helvetica-Bold')
        label(c, 36, ry - 14, msg, size=6, color=INK3)
        # Time
        label(c, w - 30, ry - 10, 'recién', size=6, color=INK3)
        ry -= 26


# ===== HEADER/FOOTER en cada página =====

def page_header_footer(canvas_obj, doc):
    """Header sutil + footer con paginado."""
    canvas_obj.saveState()
    # Footer
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.setFillColor(INK3)
    canvas_obj.drawString(MARGIN, 1.2 * cm, 'Panel de Servicios · El Desembarco')
    canvas_obj.drawRightString(PAGE_W - MARGIN, 1.2 * cm, f'Página {doc.page}')
    # Línea
    canvas_obj.setStrokeColor(LINE)
    canvas_obj.setLineWidth(0.4)
    canvas_obj.line(MARGIN, 1.5 * cm, PAGE_W - MARGIN, 1.5 * cm)
    # Header solo desde página 2
    if doc.page > 1:
        canvas_obj.setFont('Helvetica-Oblique', 8)
        canvas_obj.setFillColor(ORANGE)
        canvas_obj.drawString(MARGIN, PAGE_H - 1.2 * cm, 'Manual de uso')
    canvas_obj.restoreState()


def cover_page_decoration(canvas_obj, doc):
    """Adornos solo de la portada."""
    canvas_obj.saveState()
    # Fondo color
    canvas_obj.setFillColor(BG_DARK)
    canvas_obj.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Banda naranja vertical izquierda
    canvas_obj.setFillColor(ORANGE)
    canvas_obj.rect(0, 0, 0.6 * cm, PAGE_H, fill=1, stroke=0)
    # Logo grande arriba
    canvas_obj.setFillColor(ORANGE)
    canvas_obj.circle(MARGIN + 25, PAGE_H - 3 * cm, 20, fill=1, stroke=0)
    canvas_obj.setFont('Helvetica-Bold', 26)
    canvas_obj.setFillColor(white)
    canvas_obj.drawCentredString(MARGIN + 25, PAGE_H - 3.3 * cm, 'D')
    canvas_obj.restoreState()


# ===== Construir PDF =====

def build_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=MARGIN + 0.5 * cm,
        title='Manual · Panel de Servicios El Desembarco',
        author='El Desembarco',
    )

    story = []

    # ============ PORTADA ============
    # Espacio para logo (dibujado por cover_page_decoration via onFirstPage)
    story.append(Spacer(1, 5.5 * cm))
    cover_title = ParagraphStyle(
        'CoverTitle', fontName='Helvetica-Bold', fontSize=42, textColor=white,
        leading=46, alignment=TA_LEFT,
    )
    cover_subtitle = ParagraphStyle(
        'CoverSub', fontName='Helvetica-Oblique', fontSize=24, textColor=ORANGE,
        leading=28, alignment=TA_LEFT, spaceBefore=12,
    )
    cover_meta = ParagraphStyle(
        'CoverMeta', fontName='Helvetica', fontSize=11, textColor=HexColor('#aaaaaa'),
        leading=15, alignment=TA_LEFT, spaceBefore=40,
    )
    story.append(Paragraph('Panel de<br/>Servicios', cover_title))
    story.append(Paragraph('Manual de uso', cover_subtitle))
    story.append(Spacer(1, 6 * cm))
    story.append(Paragraph(
        'El Desembarco · Sistema de gestión de facturas de servicios<br/>'
        'Versión 1.0 · Abril 2026<br/>'
        '<br/>'
        '<font color="#c8422b">https://servicios-desembarco.vercel.app</font>',
        cover_meta
    ))
    story.append(PageBreak())

    # ============ ÍNDICE ============
    story.append(Paragraph('Contenido', style_h1))
    story.append(Spacer(1, 6))

    toc = [
        ('1', 'Bienvenida', '3'),
        ('2', 'Cómo entrar al panel · login con Google', '3'),
        ('3', 'Tour del panel · sidebar, topbar y vistas', '4'),
        ('4', 'Cómo entran las facturas · pipeline general', '5'),
        ('5', 'Ingesta automática por email', '6'),
        ('6', 'Subida manual de PDFs', '7'),
        ('7', 'Vista Planilla · ver, filtrar, editar', '8'),
        ('8', 'Vista Calendario · cockpit de pagos', '9'),
        ('9', 'Vista Reportes · análisis por categoría', '10'),
        ('10', 'Vista Revisión · facturas que la IA no pudo categorizar', '11'),
        ('11', 'Detalle de una factura · drawer y auditoría', '12'),
        ('12', 'Recibos de pago · marcar facturas como pagadas', '13'),
        ('13', 'Tips, atajos y troubleshooting', '14'),
    ]
    toc_data = [[Paragraph(f'<b>{n}</b>', style_body),
                 Paragraph(t, style_body),
                 Paragraph(f'<font color="#888">{p}</font>', style_body)] for n, t, p in toc]
    toc_table = Table(toc_data, colWidths=[1 * cm, 13 * cm, 1.5 * cm])
    toc_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, LINE),
    ]))
    story.append(toc_table)
    story.append(PageBreak())

    # ============ 1. Bienvenida ============
    story.append(Paragraph('1. Bienvenida', style_h1))
    story.append(Paragraph(
        'El <b>Panel de Servicios</b> centraliza la gestión de facturas recurrentes de los locales de '
        'El Desembarco. Conecta tres piezas en un solo lugar:',
        style_body))
    story.append(ListFlowable([
        ListItem(Paragraph('<b>Email automático</b> — las casillas corporativas que se configuren reciben los PDFs.', style_body)),
        ListItem(Paragraph('<b>Inteligencia artificial</b> — Gemini Vision lee cada factura y extrae los datos.', style_body)),
        ListItem(Paragraph('<b>Google Sheet</b> — todo queda registrado con auditoría y se ve en este panel.', style_body)),
    ], bulletType='bullet'))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        '<b>El objetivo</b>: que el equipo no tenga que cargar una factura a mano nunca más, y que cualquiera '
        'pueda ver en segundos cuánto se debe, qué vence, dónde están los pagos del mes y el histórico de cada local.',
        style_callout))

    # ============ 2. Login ============
    story.append(Spacer(1, 12))
    story.append(Paragraph('2. Cómo entrar al panel', style_h1))
    story.append(Paragraph(
        'Abrí <b>https://servicios-desembarco.vercel.app</b> en tu navegador. Te aparece la pantalla de login.',
        style_body))
    story.append(Spacer(1, 4))
    story.append(Wireframe(CONTENT_W, 200, draw_login, 'Pantalla de login · acceso solo con cuenta @eldesembarco.com'))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        '<b>Hacé click en "Continuar con Google"</b> y elegí tu cuenta corporativa @eldesembarco.com. Si entrás con '
        'una cuenta de otro dominio, el sistema te rechaza automáticamente — solo cuentas de la empresa pueden ver '
        'los datos.',
        style_body))
    story.append(Paragraph(
        '<b>La sesión dura aproximadamente 1 hora</b>. Cuando vence, te devuelve a la pantalla de login. Es normal y seguro.',
        style_body))
    story.append(PageBreak())

    # ============ 3. Tour del panel ============
    story.append(Paragraph('3. Tour del panel', style_h1))
    story.append(Wireframe(CONTENT_W, 280, draw_app_layout, 'Layout general · sidebar a la izquierda, topbar arriba, planilla en el centro'))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        '<b>Sidebar (izquierda)</b>: navegás entre vistas. Se puede colapsar con la flecha de arriba para ganar espacio. '
        'Los contadores en rojo/naranja avisan vencidos y nuevas. Tu cuenta aparece abajo con foto y email.',
        style_body))
    story.append(Paragraph(
        '<b>Topbar (arriba)</b>: búsqueda global (filtra todas las vistas), botón de refresh manual, toggle '
        'modo claro/oscuro, botón "Nueva factura" (atajo a Ingesta IA), y tu badge con menú de cerrar sesión.',
        style_body))
    story.append(Paragraph(
        '<b>Vistas principales</b>:',
        style_body))
    vistas = [
        ('Panel de servicios', 'Matriz Local × Servicio del mes actual con códigos de color por estado.'),
        ('Planilla', 'Tabla tipo Excel con filtros, sort, edición inline, todas las facturas del mes.'),
        ('Nuevas facturas', 'Facturas que ingresaron en las últimas 24 horas.'),
        ('Calendario', 'Heatmap anual + radar de 7 días + mes detallado con eventos por día.'),
        ('Ingesta IA', 'Drop zone para subir PDFs manualmente (físicos escaneados, etc).'),
        ('Revisión', 'Facturas que la IA no pudo categorizar — las resolvés a mano acá.'),
        ('Reportes', 'KPIs, gasto por categoría/local/servicio, evolución 12 meses.'),
    ]
    vistas_data = [[Paragraph(f'<b>{n}</b>', style_body), Paragraph(d, style_body)] for n, d in vistas]
    vistas_table = Table(vistas_data, colWidths=[4 * cm, 11.5 * cm])
    vistas_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, LINE),
    ]))
    story.append(vistas_table)
    story.append(PageBreak())

    # ============ 4. Pipeline ============
    story.append(Paragraph('4. Cómo entran las facturas', style_h1))
    story.append(Paragraph(
        'El sistema combina <b>email automático</b> y <b>subida manual</b>. Una vez que un PDF entra al pipeline, '
        'pasa siempre por las mismas etapas:',
        style_body))
    story.append(Spacer(1, 6))
    story.append(Wireframe(CONTENT_W, 130, draw_pipeline, 'Pipeline de ingreso · todas las facturas siguen este recorrido'))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        '<b>1. Recepción</b> — el PDF llega por email a alguna de las casillas corporativas configuradas en el sistema, '
        'o lo subís manualmente desde la pantalla de Ingesta IA.',
        style_body))
    story.append(Paragraph(
        '<b>2. Filtro inteligente</b> — un Apps Script en la cuenta de email aplica heurísticas instantáneas '
        '(remitente, asunto, nombre del adjunto). Si la decisión no es clara, le pregunta a Gemini Flash con metadata '
        '(sin abrir el PDF, super barato). Solo lo que parece factura sigue al siguiente paso.',
        style_body))
    story.append(Paragraph(
        '<b>3. Drive folder</b> — los PDFs que pasaron el filtro se suben a una carpeta de Google Drive específica '
        'que está siendo monitoreada por n8n cada 5 minutos.',
        style_body))
    story.append(Paragraph(
        '<b>4. Procesamiento con Gemini Vision</b> — n8n levanta el PDF y se lo manda a Gemini Vision, que extrae los '
        'campos relevantes: proveedor, monto, vencimiento, número de cliente, fecha de emisión, etc. Después intenta '
        'matchear el local + servicio contra la tabla CuentasServicio usando el número de cliente.',
        style_body))
    story.append(Paragraph(
        '<b>5. Registro</b> — si la IA matchea con éxito, la factura aparece directo en la planilla con todos los '
        'datos cargados. Si no matchea (es de un proveedor nuevo o un local que no reconoce), va a Revisión para que '
        'vos la categorices a mano. Una vez resuelta, el sistema "aprende" y la próxima factura del mismo proveedor '
        'matchea automáticamente.',
        style_body))
    story.append(PageBreak())

    # ============ 5. Email automático ============
    story.append(Paragraph('5. Ingesta automática por email', style_h1))
    story.append(Paragraph(
        'Las casillas corporativas configuradas reciben los emails con facturas adjuntas. Un Apps Script revisa '
        'cada casilla cada 5 minutos y procesa los emails nuevos que tengan PDF. Las casillas se configuran al setup '
        'inicial y se pueden cambiar/agregar después editando el script — no están hardcodeadas en el sistema.',
        style_body))
    story.append(Paragraph('Filtro en 2 capas', style_h2))
    story.append(Paragraph(
        '<b>Capa 1 — Heurísticas (gratis, instantáneas)</b>',
        style_h3))
    story.append(Paragraph(
        'Compara el remitente contra una lista blanca (Edenor, Naturgy, Aysa, AFIP, ARBA…) y una lista negra '
        '(Mailchimp, newsletters, noreply de redes sociales…). También analiza palabras clave del asunto y del nombre del '
        'adjunto: "factura", "boleta", "vencimiento" suman; "newsletter", "promo", "cv", "cotización" restan.',
        style_body))
    story.append(Paragraph(
        '<b>Capa 2 — Gemini Flash con metadata (~$0,00002 por consulta)</b>',
        style_h3))
    story.append(Paragraph(
        'Si la capa 1 no está segura (puntaje neutro), le pasa a Gemini Flash sólo el remitente + asunto + nombre del '
        'adjunto (no abre el PDF) y le pregunta si parece una factura. Esto cuesta una fracción de centavo por email '
        'dudoso.',
        style_body))
    story.append(Paragraph(
        '<b>El resultado</b>: ~80% de los emails se decide gratis con la capa 1, ~15% pasa por la capa 2 que es '
        'baratísima, y solo el 5% real llega al pipeline pesado de Gemini Vision sobre el PDF entero. Gracias al filtro '
        'el costo por email cae de ~$0.005 a ~$0.0003 — 16 veces más barato.',
        style_callout))
    story.append(Paragraph('Etiquetas de Gmail', style_h2))
    etiquetas = [
        ('<b>Facturas</b>', 'pendiente de evaluar (recién llegado, todavía no procesado)'),
        ('<b>Facturas Procesadas</b>', 'pasó el filtro y se subió a Drive — entra al pipeline IA'),
        ('<b>Facturas Ignoradas</b>', 'el filtro decidió que no es factura (newsletter, CV, promo…)'),
    ]
    et_data = [[Paragraph(n, style_body), Paragraph(d, style_body)] for n, d in etiquetas]
    et_table = Table(et_data, colWidths=[5 * cm, 10.5 * cm])
    et_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, LINE),
    ]))
    story.append(et_table)
    story.append(Paragraph(
        '<b>Tip</b>: si una factura real cae por error en "Facturas Ignoradas", la podés mover manualmente desde Gmail '
        'al label "Facturas" y el script la reprocesa en el próximo ciclo.',
        style_body))
    story.append(PageBreak())

    # ============ 6. Subida manual ============
    story.append(Paragraph('6. Subida manual de PDFs', style_h1))
    story.append(Paragraph(
        'Cuando una factura no llega por email — porque vino en papel, te la pasaron por WhatsApp, escaneaste un '
        'comprobante físico, etc. — la subís a mano desde el panel.',
        style_body))
    story.append(Spacer(1, 4))
    story.append(Wireframe(CONTENT_W, 200, draw_dropzone, 'Arrastrá un PDF en cualquier pantalla del panel y aparece este overlay'))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        '<b>Dos formas de subir</b>:',
        style_h3))
    story.append(ListFlowable([
        ListItem(Paragraph(
            '<b>Drag &amp; drop global</b>: arrastrá uno o más PDFs sobre cualquier pantalla del panel. '
            'Aparece un overlay grande "Soltá el PDF acá" — soltás y se procesan en paralelo.', style_body)),
        ListItem(Paragraph(
            '<b>Vista Ingesta IA</b>: en el sidebar tenés la opción "Ingesta IA". Tiene una zona de drop más '
            'pequeña + botón "Elegir PDF" para abrir el explorador de archivos. Ahí también ves el historial de '
            'tus subidas recientes.', style_body)),
    ], bulletType='bullet'))
    story.append(Spacer(1, 6))
    story.append(Paragraph('Estados de cada subida', style_h3))
    story.append(Wireframe(CONTENT_W, 220, draw_ingesta, 'Pantalla Ingesta IA con dropzone arriba y subidas recientes abajo'))
    story.append(Spacer(1, 6))
    estados = [
        ('<b>Leyendo PDF</b>', 'lee el archivo del disco a base64'),
        ('<b>Subiendo</b>', 'envía al servidor con barra de progreso real (porcentaje)'),
        ('<b>IA procesando…</b>', 'recibido, Gemini Vision analiza el PDF (puede tardar 10-30s)'),
        ('<b>Factura creada → Edenor · Boedo</b>', 'la IA matcheó y la factura aparece en la planilla. Click en el chip y abre el detalle.'),
        ('<b>Probable Revisión</b>', 'pasaron 35s sin que aparezca, asumimos que fue a Revisión. Click va directo a esa pantalla.'),
        ('<b>Error</b>', 'algo falló. Mensaje en rojo con el motivo.'),
    ]
    est_data = [[Paragraph(n, style_body), Paragraph(d, style_body)] for n, d in estados]
    est_table = Table(est_data, colWidths=[6 * cm, 9.5 * cm])
    est_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, LINE),
    ]))
    story.append(est_table)
    story.append(PageBreak())

    # ============ 7. Vista Planilla ============
    story.append(Paragraph('7. Vista Planilla', style_h1))
    story.append(Paragraph(
        'La planilla muestra todas las facturas del mes seleccionado en formato tabla, similar a Excel pero con '
        'edición inline e integración automática.',
        style_body))
    story.append(Paragraph('Operaciones principales', style_h2))
    ops = [
        ('Filtros', 'Por local, categoría, estado (PAGO/DEUDA/VENCIDO). Búsqueda libre por servicio, titular, observación. Todos los filtros se combinan.'),
        ('Sort', 'Click en cualquier encabezado de columna para ordenar ascendente/descendente.'),
        ('Editar monto en línea', 'Click sobre el monto y editás directamente. Si ponés un valor negativo, te avisa con un ícono de alerta — es probable error de la IA.'),
        ('Editar campos extendidos', 'El botón ⚙ al final de cada fila abre un modal con forma de pago, número de cliente, titular, teléfono, credenciales web y observaciones.'),
        ('Registrar pago', 'Click sobre la fila → drawer de detalle → botón "Registrar pago" abre modal con fecha y forma de pago.'),
        ('Mostrar/ocultar columnas', 'Botón "Columnas" del toolbar. Por default están visibles las más útiles; podés activar N° cliente, titular, etc.'),
        ('Pantalla completa', 'Botón "Pantalla completa" oculta sidebar/topbar. ESC para salir.'),
        ('Ver todos los meses', 'Por default muestra solo el mes actual. Toggle para ver el histórico completo.'),
    ]
    ops_data = [[Paragraph(f'<b>{n}</b>', style_body), Paragraph(d, style_body)] for n, d in ops]
    ops_table = Table(ops_data, colWidths=[5 * cm, 10.5 * cm])
    ops_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, LINE),
    ]))
    story.append(ops_table)
    story.append(Paragraph('Códigos visuales', style_h2))
    codigos = [
        ('<font color="#c43a3a">●</font> <b>VENCIDO</b>', 'vencimiento ya pasó y no fue pagada'),
        ('<font color="#d97706">●</font> <b>DEUDA</b>', 'pendiente de pago, vence en el futuro'),
        ('<font color="#2d7a4d">●</font> <b>PAGO</b>', 'pagada (con fecha y forma de pago registrados)'),
        ('<font color="#d97706">▲</font> <b>Urgente</b>', 'vence en menos de 3 días'),
    ]
    cod_data = [[Paragraph(n, style_body), Paragraph(d, style_body)] for n, d in codigos]
    cod_table = Table(cod_data, colWidths=[5 * cm, 10.5 * cm])
    cod_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(cod_table)
    story.append(PageBreak())

    # ============ 8. Calendario ============
    story.append(Paragraph('8. Vista Calendario', style_h1))
    story.append(Paragraph(
        'El calendario es un <b>cockpit de pagos</b>: combina cuatro visualizaciones para entender el ritmo de '
        'facturación a distintas escalas.',
        style_body))
    story.append(Paragraph('Heatmap anual', style_h2))
    story.append(Wireframe(CONTENT_W, 100, draw_heatmap, '53 semanas × 7 días · color = intensidad de gasto'))
    story.append(Paragraph(
        'Visualización tipo "GitHub contributions": cada cuadradito es un día del año. Cuanto más oscuro/naranja, más '
        'plata venció ese día. Hover muestra el detalle, click salta al mes en la grilla mensual.',
        style_body))
    story.append(Paragraph('Radar de 7 días', style_h2))
    story.append(Paragraph(
        'Cards horizontales con countdown: HOY, MAÑANA, EN 2D, EN 3D… cada una muestra cuántas facturas vencen ese día '
        'y por qué monto. La card de HOY pulsa visualmente si hay vencimientos pendientes.',
        style_body))
    story.append(Paragraph('Calendario mensual', style_h2))
    story.append(Paragraph(
        'Grilla 7 columnas (Lun a Dom). Cada celda del día muestra:',
        style_body))
    story.append(ListFlowable([
        ListItem(Paragraph('Chips por factura con borde de color según categoría (Energía, Gas, Agua…)', style_body)),
        ListItem(Paragraph('Conteo de facturas en la esquina superior derecha', style_body)),
        ListItem(Paragraph('<b>Barra de intensidad</b> abajo de cada celda — proporcional al monto del día relativo al máximo del mes.', style_body)),
        ListItem(Paragraph('Tinte rojo si hay vencidas', style_body)),
        ListItem(Paragraph('Anillo naranja en el día actual', style_body)),
    ], bulletType='bullet'))
    story.append(Paragraph(
        'Click en cualquier día abre un drawer lateral con la lista detallada de facturas + acciones rápidas '
        '("Ver detalle", "Registrar pago" si está pendiente).',
        style_body))
    story.append(Paragraph('Toggles', style_h2))
    story.append(Paragraph(
        'Arriba podés cambiar entre <b>Vencimientos / Pagos / Ambos</b> — todas las visualizaciones se actualizan. También '
        'tenés filtros por <b>Local</b> y <b>Categoría</b>.',
        style_body))
    story.append(PageBreak())

    # ============ 9. Reportes ============
    story.append(Paragraph('9. Vista Reportes', style_h1))
    story.append(Paragraph(
        'Reportes te muestra el panorama financiero del mes elegido — KPIs principales arriba y desgloses '
        'visuales debajo.',
        style_body))
    story.append(Spacer(1, 4))
    story.append(Wireframe(CONTENT_W, 220, draw_reportes, 'KPIs del mes y gasto desglosado por categoría'))
    story.append(Spacer(1, 6))
    story.append(Paragraph('KPIs', style_h2))
    kpidesc = [
        ('Facturado', 'total facturado en el mes (todas las facturas, sin importar estado). Tendencia % vs mes anterior.'),
        ('Pagado', 'total ya pagado. Barra de progreso muestra el % del facturado.'),
        ('Deuda viva', 'DEUDA + VENCIDO. Si hay vencidas, el borde superior se pinta de rojo.'),
        ('Servicios pagos', 'cuántas facturas de cuántas se pagaron en el mes (ej: 187/312).'),
    ]
    kp_data = [[Paragraph(f'<b>{n}</b>', style_body), Paragraph(d, style_body)] for n, d in kpidesc]
    kp_table = Table(kp_data, colWidths=[3.5 * cm, 12 * cm])
    kp_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, LINE),
    ]))
    story.append(kp_table)
    story.append(Paragraph('Gráficos', style_h2))
    story.append(ListFlowable([
        ListItem(Paragraph('<b>Gasto por categoría</b>: Energía / Gas / Agua / Conectividad / Impuestos / etc., con porcentaje del total.', style_body)),
        ListItem(Paragraph('<b>Top locales</b>: top 10 locales por gasto del mes.', style_body)),
        ListItem(Paragraph('<b>Top servicios</b>: top 10 servicios más caros del mes.', style_body)),
        ListItem(Paragraph('<b>Evolución 12 meses</b>: line chart con el facturado total mes a mes. Hover muestra tooltip, click salta al mes.', style_body)),
        ListItem(Paragraph('<b>Próximos vencimientos</b>: lista priorizada de DEUDA/VENCIDO ordenada por fecha.', style_body)),
        ListItem(Paragraph('<b>Facturas más caras del mes</b>: top 8.', style_body)),
    ], bulletType='bullet'))
    story.append(PageBreak())

    # ============ 10. Revisión ============
    story.append(Paragraph('10. Vista Revisión', style_h1))
    story.append(Paragraph(
        'Cuando la IA <b>no puede categorizar</b> una factura, no la descarta — la manda a Revisión para que vos la '
        'resuelvas a mano. Casos típicos:',
        style_body))
    story.append(ListFlowable([
        ListItem(Paragraph('Proveedor nuevo cuyo número de cliente no está en CuentasServicio.', style_body)),
        ListItem(Paragraph('Factura con texto ambiguo o mal escaneada (Gemini extrae con baja confianza).', style_body)),
        ListItem(Paragraph('Comprobante de pago que no encuentra factura matching para marcar PAGO.', style_body)),
    ], bulletType='bullet'))
    story.append(Paragraph('Cómo resolver una factura en Revisión', style_h2))
    story.append(Paragraph(
        'Cada item es una card colapsable con todos los datos que Gemini logró extraer + un link al PDF original. '
        'Para resolver:',
        style_body))
    story.append(ListFlowable([
        ListItem(Paragraph('<b>1. Abrí la card</b> y mirá el motivo (ej. "sin match con CuentasServicio · numero_cliente=12345678").', style_body)),
        ListItem(Paragraph('<b>2. Verificá los datos extraídos</b> — proveedor, monto, fechas. Si hay error, podés corregir.', style_body)),
        ListItem(Paragraph('<b>3. Asigná el local</b> de un dropdown.', style_body)),
        ListItem(Paragraph('<b>4. Confirmar</b> — la factura se crea en la planilla y el sistema "aprende": guarda la combinación '
                          'servicio + número de cliente + local en CuentasServicio. La próxima factura del mismo proveedor matchea automáticamente.', style_body)),
    ], bulletType='bullet'))
    story.append(Paragraph(
        'También podés <b>descartar</b> (no era factura) o <b>re-procesar</b> (forzar al pipeline a leer de nuevo el PDF — útil si '
        'corregiste algo en el sheet CuentasServicio).',
        style_body))
    story.append(Paragraph(
        '<b>Self-learning</b>: cada factura confirmada manualmente entrena al sistema. Después de unas pocas resoluciones, '
        'la mayoría de los proveedores recurrentes (Edenor, Naturgy, Aysa, Telecentro…) van a matchear solos sin pasar por Revisión.',
        style_callout))
    story.append(PageBreak())

    # ============ 11. Detalle de factura ============
    story.append(Paragraph('11. Detalle de una factura', style_h1))
    story.append(Paragraph(
        'En cualquier vista (planilla, calendario, reportes) podés hacer click en una factura y se abre un drawer '
        'lateral con toda la información:',
        style_body))
    story.append(Spacer(1, 4))
    story.append(Wireframe(CONTENT_W, 320, draw_factura_detail, 'Drawer de detalle · monto destacado, datos completos, auditoría, botones de acción'))
    story.append(Spacer(1, 6))
    story.append(Paragraph('Bloques del detalle', style_h2))
    bloques = [
        ('Header', 'Categoría (chip de color), estado (PAGO/DEUDA/VENCIDO), proveedor, local, mes.'),
        ('Monto destacado', 'Card con el monto grande, días hasta vencer (en rojo si vencida, naranja si próxima).'),
        ('Ingesta IA', 'Solo si la factura vino del pipeline IA — muestra confianza de extracción y link al PDF original.'),
        ('Datos del servicio', 'N° cliente, titular, teléfono, forma de pago, vencimiento, fecha de pago. Botones para copiar al portapapeles.'),
        ('Acceso web', 'Si está cargado, usuario y contraseña del portal del proveedor (con toggle de mostrar/ocultar).'),
        ('Auditoría', 'Quién creó la factura (IA o un email), quién hizo la última edición, cuándo. Si fue revisada manualmente, queda marcado.'),
        ('Observaciones', 'Notas internas sobre la factura.'),
        ('Histórico', 'Las facturas del mismo servicio/local en meses anteriores.'),
    ]
    bl_data = [[Paragraph(f'<b>{n}</b>', style_body), Paragraph(d, style_body)] for n, d in bloques]
    bl_table = Table(bl_data, colWidths=[3.5 * cm, 12 * cm])
    bl_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, LINE),
    ]))
    story.append(bl_table)
    story.append(Paragraph('Acciones del footer', style_h2))
    story.append(ListFlowable([
        ListItem(Paragraph('<b>Ir al portal</b>: link al portal del proveedor (próximamente).', style_body)),
        ListItem(Paragraph('<b>Registrar pago</b>: abre modal donde elegís fecha y forma de pago. Cambia estado a PAGO.', style_body)),
        ListItem(Paragraph('<b>Revertir pago</b>: solo aparece si el estado es PAGO. Vuelve la factura a DEUDA o VENCIDO según corresponda.', style_body)),
    ], bulletType='bullet'))
    story.append(PageBreak())

    # ============ 12. Recibos de pago ============
    story.append(Paragraph('12. Recibos de pago', style_h1))
    story.append(Paragraph(
        'El sistema entiende dos tipos de PDF: <b>facturas</b> (un cobro pendiente) y <b>recibos / comprobantes de pago</b> '
        '(constancia de un pago ya hecho).',
        style_body))
    story.append(Paragraph('¿Cuándo subir un recibo?', style_h2))
    story.append(Paragraph(
        'Cuando una factura se pagó <b>fuera del débito automático</b>: con tarjeta de crédito, transferencia '
        'bancaria, en Pago Fácil/Rapipago, vouchers de pagomiscuentas, etc. La cuenta de email o vos personalmente recibís '
        'el comprobante y lo subís al panel.',
        style_body))
    story.append(Paragraph('¿Qué hace el sistema con un recibo?', style_h2))
    story.append(Paragraph(
        'Gemini Vision identifica que es un comprobante (no una factura) y entra en una rama distinta del pipeline:',
        style_body))
    story.append(ListFlowable([
        ListItem(Paragraph('<b>1.</b> Lee del PDF: proveedor, número de cliente, número de factura referenciado, monto, fecha de pago, forma de pago.', style_body)),
        ListItem(Paragraph('<b>2.</b> Busca en la planilla la <b>factura matching</b> usando un score combinado: proveedor (3pt) + número de cliente (4pt) + número de factura referenciado en observaciones (5pt) + monto similar en ±2% (4pt).', style_body)),
        ListItem(Paragraph('<b>3.</b> Si encuentra match con score ≥ 5: <b>marca esa factura como PAGO</b> con la fecha y forma extraídas del recibo. Tu email queda registrado como updated_by en auditoría.', style_body)),
        ListItem(Paragraph('<b>4.</b> Si no encuentra match: va a Revisión con motivo "Recibo de pago sin factura matching" para que lo resuelvas a mano.', style_body)),
    ], bulletType='bullet'))
    story.append(Paragraph(
        '<b>Caso de uso típico</b>: pagás Edenor de Boedo con tarjeta. Te llega el voucher por email. Lo subís al panel '
        '(o lo recibe automáticamente la cuenta corporativa). En segundos, la factura de Edenor / Boedo del mes pasa de '
        'DEUDA a PAGO sin que tengas que hacer nada manual.',
        style_callout))
    story.append(PageBreak())

    # ============ 13. Tips & FAQ ============
    story.append(Paragraph('13. Tips, atajos y troubleshooting', style_h1))
    story.append(Paragraph('Atajos útiles', style_h2))
    atajos = [
        ('Ctrl+Shift+R', 'recarga forzada del panel ignorando cache (úsalo cuando hago un deploy).'),
        ('ESC', 'sale de pantalla completa de la planilla.'),
        ('Drag & drop', 'desde cualquier pantalla — no hace falta ir a Ingesta IA.'),
        ('Click en chip de upload "matched"', 'abre el detalle de la factura recién creada.'),
        ('Click en celda del calendario', 'abre el drawer lateral del día.'),
    ]
    at_data = [[Paragraph(f'<b>{n}</b>', style_body), Paragraph(d, style_body)] for n, d in atajos]
    at_table = Table(at_data, colWidths=[5 * cm, 10.5 * cm])
    at_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, LINE),
    ]))
    story.append(at_table)

    story.append(Paragraph('Preguntas frecuentes', style_h2))

    faq = [
        ('Subí una factura por email y todavía no aparece en el panel.',
         'El email collector revisa la casilla cada 5 minutos. n8n revisa Drive cada 5 minutos también. En el peor caso, una factura puede tardar hasta 10 minutos desde que llega el email hasta aparecer en la planilla. Si pasaron más de 15 minutos: andá a Revisión, puede haber caído ahí.'),
        ('Una factura quedó con monto raro o datos incorrectos.',
         'Cualquier campo lo podés corregir desde el panel: monto inline, otros campos con el botón ⚙. Las correcciones quedan auditadas con tu email.'),
        ('Una factura está mal categorizada (servicio o local equivocado).',
         'Por ahora no se puede cambiar local/servicio desde el panel. Editalo directamente en el Sheet y la próxima factura del mismo proveedor va a matchear bien gracias al self-learning.'),
        ('La sesión se cerró y no entiendo por qué.',
         'El token de Google dura ~1 hora. Cuando vence, el panel te manda al login automáticamente. Iniciás sesión de nuevo y seguís donde estabas.'),
        ('Llega mucho spam con PDFs adjuntos a la casilla.',
         'El filtro inteligente del Apps Script bloquea la mayoría. Si pasa basura igual, agregá el remitente o keyword del asunto a la lista negra del script. Mirá la hoja EmailFilterLog para ver qué decidió cada email y por qué.'),
        ('¿Puedo subir varios PDFs al mismo tiempo?',
         'Sí. Drag & drop múltiples archivos sobre el panel y se procesan en paralelo. Vas a ver una row por upload con su barra de progreso.'),
        ('¿Cómo veo facturas de meses anteriores?',
         'En Planilla activá el toggle "Ver todos los meses". O en Reportes/Calendario navegá con las flechas de mes/año.'),
        ('¿Qué hago si Gemini extrae mal los datos de una factura recurrente?',
         'Puede ser un problema de templates raros. Editalo manualmente. La factura del próximo mes va a usar el mismo extractor — si el problema persiste, avisame con el PDF y ajustamos el prompt de Gemini.'),
    ]
    for q, a in faq:
        story.append(Paragraph(f'<b>{q}</b>', style_body))
        story.append(Paragraph(a, style_body))
        story.append(Spacer(1, 4))

    story.append(Spacer(1, 14))
    story.append(Paragraph(
        '<b>Soporte</b>: cualquier duda, error inesperado, o feature que falte, escribime con un screenshot del problema '
        'y vemos. El sistema sigue evolucionando.',
        style_callout))

    # ===== Generar el PDF =====
    doc.build(story, onFirstPage=cover_page_decoration, onLaterPages=page_header_footer)
    print(f'PDF generado: {output_path}')


if __name__ == '__main__':
    import os
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Manual-Panel-Servicios.pdf')
    build_pdf(out)
