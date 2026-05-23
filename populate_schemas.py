# -*- coding: utf-8 -*-
"""
Генерация schema_data для шагов 2, 3, 4 задач 1-10.
Задача 1 уже имеет schema_data — обновляем только задачи 2-10.
"""
import os
import json
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "eora.settings")
django.setup()

from learning.models import TaskSolutionStep, SolutionStep

STEPS = {s.order: s for s in SolutionStep.objects.filter(method_id=1)}

# Каждая задача → dict {step_order: schema_data}
# step 2 = начальное положение
# step 3 = последующие положения
# step 4 = участки движения с характеристиками

SCHEMAS = {
    # ──────────────────────────────────────────────────────────────────
    # ЗАДАЧА 2: Муха и скворец (correct=1.67 м)
    # Скворец на расстоянии 5 м от мухи, оба летят
    # ──────────────────────────────────────────────────────────────────
    2: {
        2: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t2s2_p1", "type": "body-circle", "x": 200, "y": 250, "color": "#22c55e", "radius": 8},
                {"id": "t2s2_l1", "type": "text", "x": 185, "y": 270, "text": "Скворец", "fontSize": 13, "color": "#1a1a2e"},
                {"id": "t2s2_la", "type": "label", "x": 195, "y": 225, "symbol": "A", "fontSize": 16, "color": "#1a1a2e"},
                {"id": "t2s2_p2", "type": "body-circle", "x": 400, "y": 250, "color": "#ef4444", "radius": 6},
                {"id": "t2s2_l2", "type": "text", "x": 390, "y": 270, "text": "Муха", "fontSize": 13, "color": "#1a1a2e"},
                {"id": "t2s2_lb", "type": "label", "x": 395, "y": 225, "symbol": "B", "fontSize": 16, "color": "#1a1a2e"},
                {"id": "t2s2_dim", "type": "line", "x": 200, "y": 300, "length": 200, "rotation": 0, "color": "#64748b", "strokeWidth": 1, "dashed": True},
                {"id": "t2s2_dt", "type": "text", "x": 275, "y": 310, "text": "5 м", "fontSize": 14, "color": "#64748b"},
            ],
        },
        3: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t2s3_p1", "type": "body-circle", "x": 200, "y": 250, "color": "#22c55e", "radius": 8},
                {"id": "t2s3_la", "type": "label", "x": 195, "y": 225, "symbol": "A", "fontSize": 16, "color": "#1a1a2e"},
                {"id": "t2s3_p2", "type": "body-circle", "x": 400, "y": 250, "color": "#ef4444", "radius": 6},
                {"id": "t2s3_lb", "type": "label", "x": 395, "y": 225, "symbol": "B", "fontSize": 16, "color": "#1a1a2e"},
                {"id": "t2s3_meet", "type": "body-circle", "x": 467, "y": 250, "color": "#8b5cf6", "radius": 8},
                {"id": "t2s3_lc", "type": "label", "x": 462, "y": 225, "symbol": "C", "fontSize": 16, "color": "#1a1a2e"},
                {"id": "t2s3_lm", "type": "text", "x": 445, "y": 270, "text": "Встреча", "fontSize": 12, "color": "#8b5cf6"},
                {"id": "t2s3_v1", "type": "vector", "x": 210, "y": 210, "length": 80, "rotation": 0, "color": "#22c55e", "strokeWidth": 2},
                {"id": "t2s3_v1l", "type": "label", "x": 235, "y": 190, "symbol": "v", "subscript": "2", "fontSize": 14, "color": "#22c55e"},
                {"id": "t2s3_v2", "type": "vector", "x": 410, "y": 210, "length": 40, "rotation": 0, "color": "#ef4444", "strokeWidth": 2},
                {"id": "t2s3_v2l", "type": "label", "x": 420, "y": 190, "symbol": "v", "subscript": "1", "fontSize": 14, "color": "#ef4444"},
            ],
        },
        4: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t2s4_p1", "type": "body-circle", "x": 200, "y": 250, "color": "#22c55e", "radius": 6},
                {"id": "t2s4_la", "type": "label", "x": 195, "y": 270, "symbol": "A", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t2s4_p2", "type": "body-circle", "x": 400, "y": 250, "color": "#ef4444", "radius": 6},
                {"id": "t2s4_lb", "type": "label", "x": 395, "y": 270, "symbol": "B", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t2s4_pc", "type": "body-circle", "x": 467, "y": 250, "color": "#8b5cf6", "radius": 6},
                {"id": "t2s4_lc", "type": "label", "x": 462, "y": 270, "symbol": "C", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t2s4_line1", "type": "line", "x": 200, "y": 250, "length": 267, "rotation": 0, "color": "#22c55e", "strokeWidth": 2},
                {"id": "t2s4_s2", "type": "text", "x": 300, "y": 215, "text": "S₂ = v₂·t", "fontSize": 13, "color": "#22c55e"},
                {"id": "t2s4_line2", "type": "line", "x": 400, "y": 250, "length": 67, "rotation": 0, "color": "#ef4444", "strokeWidth": 2, "dashed": True},
                {"id": "t2s4_s1", "type": "text", "x": 410, "y": 215, "text": "S₁ = v₁·t", "fontSize": 13, "color": "#ef4444"},
                {"id": "t2s4_d5", "type": "text", "x": 275, "y": 295, "text": "Δs = 5 м", "fontSize": 13, "color": "#64748b"},
            ],
        },
    },

    # ──────────────────────────────────────────────────────────────────
    # ЗАДАЧА 3: Переплывание реки (correct=3.6 м)
    # ──────────────────────────────────────────────────────────────────
    3: {
        2: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t3s2_bank1", "type": "line", "x": 150, "y": 100, "length": 350, "rotation": 90, "color": "#94a3b8", "strokeWidth": 3},
                {"id": "t3s2_bank2", "type": "line", "x": 510, "y": 100, "length": 350, "rotation": 90, "color": "#94a3b8", "strokeWidth": 3},
                {"id": "t3s2_bl", "type": "text", "x": 120, "y": 90, "text": "Берег 1", "fontSize": 12, "color": "#64748b"},
                {"id": "t3s2_br", "type": "text", "x": 490, "y": 90, "text": "Берег 2", "fontSize": 12, "color": "#64748b"},
                {"id": "t3s2_swimmer", "type": "body-circle", "x": 160, "y": 300, "color": "#3b82f6", "radius": 8},
                {"id": "t3s2_la", "type": "label", "x": 140, "y": 310, "symbol": "A", "fontSize": 16, "color": "#1a1a2e"},
                {"id": "t3s2_d", "type": "text", "x": 310, "y": 80, "text": "d = 9 м", "fontSize": 14, "color": "#64748b"},
                {"id": "t3s2_flow", "type": "vector", "x": 300, "y": 420, "length": 70, "rotation": 90, "color": "#06b6d4", "strokeWidth": 2},
                {"id": "t3s2_flowl", "type": "text", "x": 320, "y": 440, "text": "течение", "fontSize": 12, "color": "#06b6d4"},
            ],
        },
        3: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t3s3_bank1", "type": "line", "x": 150, "y": 100, "length": 350, "rotation": 90, "color": "#94a3b8", "strokeWidth": 3},
                {"id": "t3s3_bank2", "type": "line", "x": 510, "y": 100, "length": 350, "rotation": 90, "color": "#94a3b8", "strokeWidth": 3},
                {"id": "t3s3_swimmer", "type": "body-circle", "x": 160, "y": 300, "color": "#3b82f6", "radius": 8},
                {"id": "t3s3_la", "type": "label", "x": 140, "y": 310, "symbol": "A", "fontSize": 16, "color": "#1a1a2e"},
                {"id": "t3s3_target", "type": "point", "x": 500, "y": 300, "color": "#22c55e", "radius": 6},
                {"id": "t3s3_lbt", "type": "text", "x": 510, "y": 295, "text": "Цель (B')", "fontSize": 12, "color": "#22c55e"},
                {"id": "t3s3_drift", "type": "body-circle", "x": 500, "y": 400, "color": "#ef4444", "radius": 6},
                {"id": "t3s3_lbd", "type": "text", "x": 510, "y": 395, "text": "B (снос)", "fontSize": 12, "color": "#ef4444"},
                {"id": "t3s3_swim", "type": "vector", "x": 160, "y": 300, "length": 340, "rotation": 0, "color": "#3b82f6", "strokeWidth": 2},
                {"id": "t3s3_vp", "type": "label", "x": 300, "y": 275, "symbol": "v", "subscript": "п", "fontSize": 14, "color": "#3b82f6"},
                {"id": "t3s3_driftv", "type": "vector", "x": 500, "y": 300, "length": 100, "rotation": 90, "color": "#06b6d4", "strokeWidth": 2},
                {"id": "t3s3_vt", "type": "label", "x": 510, "y": 340, "symbol": "v", "subscript": "т", "fontSize": 14, "color": "#06b6d4"},
            ],
        },
        4: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t3s4_bank1", "type": "line", "x": 150, "y": 100, "length": 350, "rotation": 90, "color": "#94a3b8", "strokeWidth": 2},
                {"id": "t3s4_bank2", "type": "line", "x": 510, "y": 100, "length": 350, "rotation": 90, "color": "#94a3b8", "strokeWidth": 2},
                {"id": "t3s4_a", "type": "body-circle", "x": 160, "y": 300, "color": "#3b82f6", "radius": 6},
                {"id": "t3s4_la", "type": "label", "x": 140, "y": 310, "symbol": "A", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t3s4_b", "type": "body-circle", "x": 500, "y": 400, "color": "#ef4444", "radius": 6},
                {"id": "t3s4_lb", "type": "label", "x": 510, "y": 395, "symbol": "B", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t3s4_swim_line", "type": "line", "x": 160, "y": 300, "length": 340, "rotation": 0, "color": "#3b82f6", "strokeWidth": 2},
                {"id": "t3s4_d", "type": "text", "x": 310, "y": 275, "text": "d = 9 м", "fontSize": 13, "color": "#3b82f6"},
                {"id": "t3s4_drift_line", "type": "line", "x": 500, "y": 300, "length": 100, "rotation": 90, "color": "#ef4444", "strokeWidth": 2, "dashed": True},
                {"id": "t3s4_s", "type": "text", "x": 510, "y": 340, "text": "S = ?", "fontSize": 13, "color": "#ef4444"},
                {"id": "t3s4_t1", "type": "text", "x": 250, "y": 250, "text": "t = d / v_плав", "fontSize": 12, "color": "#64748b"},
                {"id": "t3s4_t2", "type": "text", "x": 510, "y": 360, "text": "S = v_теч · t", "fontSize": 12, "color": "#64748b"},
            ],
        },
    },

    # ──────────────────────────────────────────────────────────────────
    # ЗАДАЧА 4: Радиосигнал от Альфа Центавра (correct=4.33 лет)
    # ──────────────────────────────────────────────────────────────────
    4: {
        2: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t4s2_star", "type": "body-circle", "x": 150, "y": 250, "color": "#f59e0b", "radius": 15},
                {"id": "t4s2_ls", "type": "text", "x": 110, "y": 280, "text": "Альфа Центавра", "fontSize": 12, "color": "#f59e0b"},
                {"id": "t4s2_la", "type": "label", "x": 145, "y": 220, "symbol": "A", "fontSize": 16, "color": "#1a1a2e"},
            ],
        },
        3: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t4s3_star", "type": "body-circle", "x": 150, "y": 250, "color": "#f59e0b", "radius": 15},
                {"id": "t4s3_la", "type": "label", "x": 145, "y": 220, "symbol": "A", "fontSize": 16, "color": "#1a1a2e"},
                {"id": "t4s3_earth", "type": "body-circle", "x": 600, "y": 250, "color": "#3b82f6", "radius": 15},
                {"id": "t4s3_le", "type": "text", "x": 580, "y": 280, "text": "Земля", "fontSize": 12, "color": "#3b82f6"},
                {"id": "t4s3_lb", "type": "label", "x": 595, "y": 220, "symbol": "B", "fontSize": 16, "color": "#1a1a2e"},
                {"id": "t4s3_signal", "type": "vector", "x": 170, "y": 250, "length": 410, "rotation": 0, "color": "#ef4444", "strokeWidth": 2},
                {"id": "t4s3_vs", "type": "text", "x": 340, "y": 225, "text": "Радиосигнал", "fontSize": 12, "color": "#ef4444"},
            ],
        },
        4: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t4s4_star", "type": "body-circle", "x": 150, "y": 250, "color": "#f59e0b", "radius": 12},
                {"id": "t4s4_la", "type": "label", "x": 145, "y": 275, "symbol": "A", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t4s4_earth", "type": "body-circle", "x": 600, "y": 250, "color": "#3b82f6", "radius": 12},
                {"id": "t4s4_lb", "type": "label", "x": 595, "y": 275, "symbol": "B", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t4s4_line", "type": "line", "x": 165, "y": 250, "length": 420, "rotation": 0, "color": "#1a1a2e", "strokeWidth": 2},
                {"id": "t4s4_s", "type": "text", "x": 330, "y": 215, "text": "S = 3,9·10¹³ км", "fontSize": 13, "color": "#1a1a2e"},
                {"id": "t4s4_v", "type": "text", "x": 330, "y": 295, "text": "v = 3·10⁵ км/с", "fontSize": 13, "color": "#ef4444"},
                {"id": "t4s4_t", "type": "text", "x": 330, "y": 320, "text": "t = S / v = ?", "fontSize": 13, "color": "#64748b"},
            ],
        },
    },

    # ──────────────────────────────────────────────────────────────────
    # ЗАДАЧА 5: Космическая станция (correct=8.0 км/с)
    # ──────────────────────────────────────────────────────────────────
    5: {
        2: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t5s2_earth", "type": "body-circle", "x": 400, "y": 300, "color": "#3b82f6", "radius": 30},
                {"id": "t5s2_le", "type": "text", "x": 380, "y": 295, "text": "Земля", "fontSize": 12, "color": "white"},
                {"id": "t5s2_station", "type": "body-circle", "x": 400, "y": 170, "color": "#f59e0b", "radius": 8},
                {"id": "t5s2_ls", "type": "text", "x": 420, "y": 165, "text": "Станция", "fontSize": 12, "color": "#f59e0b"},
                {"id": "t5s2_la", "type": "label", "x": 395, "y": 145, "symbol": "A", "fontSize": 16, "color": "#1a1a2e"},
            ],
        },
        3: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t5s3_earth", "type": "body-circle", "x": 400, "y": 300, "color": "#3b82f6", "radius": 30},
                {"id": "t5s3_le", "type": "text", "x": 380, "y": 295, "text": "Земля", "fontSize": 12, "color": "white"},
                {"id": "t5s3_a", "type": "body-circle", "x": 400, "y": 170, "color": "#f59e0b", "radius": 6},
                {"id": "t5s3_la", "type": "label", "x": 395, "y": 148, "symbol": "A", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t5s3_b", "type": "body-circle", "x": 530, "y": 200, "color": "#22c55e", "radius": 6},
                {"id": "t5s3_lb", "type": "label", "x": 540, "y": 195, "symbol": "B", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t5s3_v", "type": "vector", "x": 410, "y": 170, "length": 80, "rotation": 15, "color": "#ef4444", "strokeWidth": 2},
                {"id": "t5s3_vl", "type": "label", "x": 440, "y": 145, "symbol": "v", "fontSize": 14, "color": "#ef4444"},
            ],
        },
        4: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t5s4_a", "type": "body-circle", "x": 250, "y": 250, "color": "#f59e0b", "radius": 6},
                {"id": "t5s4_la", "type": "label", "x": 245, "y": 270, "symbol": "A", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t5s4_b", "type": "body-circle", "x": 550, "y": 250, "color": "#22c55e", "radius": 6},
                {"id": "t5s4_lb", "type": "label", "x": 545, "y": 270, "symbol": "B", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t5s4_line", "type": "line", "x": 250, "y": 250, "length": 300, "rotation": 0, "color": "#1a1a2e", "strokeWidth": 2},
                {"id": "t5s4_s", "type": "text", "x": 360, "y": 220, "text": "S = 480 км", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t5s4_t", "type": "text", "x": 360, "y": 290, "text": "t = 1 мин = 60 с", "fontSize": 13, "color": "#64748b"},
                {"id": "t5s4_vq", "type": "text", "x": 360, "y": 315, "text": "v = S/t = ?", "fontSize": 13, "color": "#ef4444"},
            ],
        },
    },

    # ──────────────────────────────────────────────────────────────────
    # ЗАДАЧА 6: Погрузка свёклы (correct=300 с)
    # ──────────────────────────────────────────────────────────────────
    6: {
        2: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t6s2_belt", "type": "line", "x": 150, "y": 280, "length": 400, "rotation": 0, "color": "#64748b", "strokeWidth": 3},
                {"id": "t6s2_blt", "type": "text", "x": 300, "y": 295, "text": "Лента транспортёра", "fontSize": 12, "color": "#64748b"},
                {"id": "t6s2_b1", "type": "body-circle", "x": 200, "y": 260, "color": "#ef4444", "radius": 8},
                {"id": "t6s2_b2", "type": "body-circle", "x": 250, "y": 260, "color": "#ef4444", "radius": 8},
                {"id": "t6s2_b3", "type": "body-circle", "x": 300, "y": 260, "color": "#ef4444", "radius": 8},
                {"id": "t6s2_b4", "type": "body-circle", "x": 350, "y": 260, "color": "#ef4444", "radius": 8},
                {"id": "t6s2_dots", "type": "text", "x": 380, "y": 255, "text": "...", "fontSize": 18, "color": "#ef4444"},
                {"id": "t6s2_lb", "type": "text", "x": 240, "y": 235, "text": "Корнеплоды (m = 2 кг)", "fontSize": 12, "color": "#ef4444"},
                {"id": "t6s2_truck", "type": "body-rect", "x": 600, "y": 250, "width": 60, "height": 40, "color": "#3b82f6"},
                {"id": "t6s2_lt", "type": "text", "x": 575, "y": 300, "text": "Автомашина (3 т)", "fontSize": 12, "color": "#3b82f6"},
                {"id": "t6s2_la", "type": "label", "x": 145, "y": 260, "symbol": "A", "fontSize": 14, "color": "#1a1a2e"},
            ],
        },
        3: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t6s3_belt", "type": "line", "x": 150, "y": 280, "length": 400, "rotation": 0, "color": "#64748b", "strokeWidth": 3},
                {"id": "t6s3_truck", "type": "body-rect", "x": 600, "y": 250, "width": 60, "height": 40, "color": "#22c55e"},
                {"id": "t6s3_lt", "type": "text", "x": 565, "y": 300, "text": "Загружена (3 т)", "fontSize": 12, "color": "#22c55e"},
                {"id": "t6s3_v", "type": "vector", "x": 200, "y": 310, "length": 120, "rotation": 0, "color": "#ef4444", "strokeWidth": 2},
                {"id": "t6s3_vl", "type": "text", "x": 230, "y": 325, "text": "v = 0,5 м/с", "fontSize": 12, "color": "#ef4444"},
                {"id": "t6s3_d", "type": "text", "x": 250, "y": 250, "text": "d = 0,1 м между корнеплодами", "fontSize": 12, "color": "#64748b"},
            ],
        },
        4: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t6s4_a", "type": "point", "x": 150, "y": 250, "color": "#1a1a2e", "radius": 5},
                {"id": "t6s4_b", "type": "point", "x": 550, "y": 250, "color": "#1a1a2e", "radius": 5},
                {"id": "t6s4_line", "type": "line", "x": 150, "y": 250, "length": 400, "rotation": 0, "color": "#1a1a2e", "strokeWidth": 2},
                {"id": "t6s4_la", "type": "label", "x": 145, "y": 265, "symbol": "A", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t6s4_lb", "type": "label", "x": 545, "y": 265, "symbol": "B", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t6s4_n", "type": "text", "x": 250, "y": 210, "text": "N = M/m = 1500 шт.", "fontSize": 13, "color": "#64748b"},
                {"id": "t6s4_l", "type": "text", "x": 300, "y": 230, "text": "L = N·d = 150 м", "fontSize": 13, "color": "#1a1a2e"},
                {"id": "t6s4_v", "type": "text", "x": 300, "y": 290, "text": "v = 0,5 м/с", "fontSize": 13, "color": "#ef4444"},
                {"id": "t6s4_t", "type": "text", "x": 300, "y": 315, "text": "t = L/v = ?", "fontSize": 13, "color": "#64748b"},
            ],
        },
    },

    # ──────────────────────────────────────────────────────────────────
    # ЗАДАЧА 7: Пуля через вагон (correct=900 м/с)
    # ──────────────────────────────────────────────────────────────────
    7: {
        2: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t7s2_wagon", "type": "body-rect", "x": 400, "y": 250, "width": 120, "height": 60, "color": "#94a3b8"},
                {"id": "t7s2_lw", "type": "text", "x": 370, "y": 250, "text": "Вагон", "fontSize": 13, "color": "#1a1a2e"},
                {"id": "t7s2_v", "type": "vector", "x": 420, "y": 200, "length": 80, "rotation": 0, "color": "#3b82f6", "strokeWidth": 2},
                {"id": "t7s2_vl", "type": "text", "x": 440, "y": 180, "text": "v_ваг = 36 км/ч", "fontSize": 12, "color": "#3b82f6"},
                {"id": "t7s2_bullet", "type": "body-circle", "x": 400, "y": 150, "color": "#ef4444", "radius": 5},
                {"id": "t7s2_bl", "type": "text", "x": 370, "y": 135, "text": "Пуля", "fontSize": 12, "color": "#ef4444"},
                {"id": "t7s2_bv", "type": "vector", "x": 400, "y": 155, "length": 60, "rotation": 90, "color": "#ef4444", "strokeWidth": 2},
            ],
        },
        3: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t7s3_wagon", "type": "body-rect", "x": 400, "y": 250, "width": 120, "height": 60, "color": "#94a3b8"},
                {"id": "t7s3_w1", "type": "line", "x": 340, "y": 220, "length": 60, "rotation": 90, "color": "#1a1a2e", "strokeWidth": 2},
                {"id": "t7s3_w2", "type": "line", "x": 460, "y": 220, "length": 60, "rotation": 90, "color": "#1a1a2e", "strokeWidth": 2},
                {"id": "t7s3_h1", "type": "point", "x": 340, "y": 240, "color": "#ef4444", "radius": 5},
                {"id": "t7s3_h2", "type": "point", "x": 463, "y": 252, "color": "#ef4444", "radius": 5},
                {"id": "t7s3_lh1", "type": "text", "x": 320, "y": 225, "text": "Вход", "fontSize": 11, "color": "#ef4444"},
                {"id": "t7s3_lh2", "type": "text", "x": 470, "y": 240, "text": "Выход", "fontSize": 11, "color": "#ef4444"},
                {"id": "t7s3_d", "type": "text", "x": 365, "y": 310, "text": "d = 2,7 м", "fontSize": 13, "color": "#1a1a2e"},
                {"id": "t7s3_delta", "type": "text", "x": 470, "y": 265, "text": "Δ = 3 см", "fontSize": 12, "color": "#8b5cf6"},
            ],
        },
        4: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t7s4_w1", "type": "line", "x": 300, "y": 180, "length": 140, "rotation": 90, "color": "#94a3b8", "strokeWidth": 2},
                {"id": "t7s4_w2", "type": "line", "x": 500, "y": 180, "length": 140, "rotation": 90, "color": "#94a3b8", "strokeWidth": 2},
                {"id": "t7s4_d", "type": "line", "x": 300, "y": 330, "length": 200, "rotation": 0, "color": "#1a1a2e", "strokeWidth": 1, "dashed": True},
                {"id": "t7s4_dl", "type": "text", "x": 370, "y": 340, "text": "d = 2,7 м", "fontSize": 13, "color": "#1a1a2e"},
                {"id": "t7s4_bullet", "type": "vector", "x": 300, "y": 230, "length": 200, "rotation": 84, "color": "#ef4444", "strokeWidth": 2},
                {"id": "t7s4_bl", "type": "text", "x": 395, "y": 200, "text": "Пуля: v_п = ?", "fontSize": 12, "color": "#ef4444"},
                {"id": "t7s4_delta_l", "type": "line", "x": 500, "y": 230, "length": 15, "rotation": 90, "color": "#8b5cf6", "strokeWidth": 2},
                {"id": "t7s4_del", "type": "text", "x": 510, "y": 235, "text": "Δ = 3 см", "fontSize": 12, "color": "#8b5cf6"},
                {"id": "t7s4_vw", "type": "vector", "x": 300, "y": 180, "length": 60, "rotation": 0, "color": "#3b82f6", "strokeWidth": 2},
                {"id": "t7s4_vwl", "type": "text", "x": 310, "y": 160, "text": "v_ваг", "fontSize": 12, "color": "#3b82f6"},
            ],
        },
    },

    # ──────────────────────────────────────────────────────────────────
    # ЗАДАЧА 8: Бикфордов шнур (correct=48 см)
    # ──────────────────────────────────────────────────────────────────
    8: {
        2: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t8s2_person", "type": "body-circle", "x": 250, "y": 250, "color": "#3b82f6", "radius": 10},
                {"id": "t8s2_lp", "type": "text", "x": 230, "y": 270, "text": "Человек", "fontSize": 12, "color": "#3b82f6"},
                {"id": "t8s2_la", "type": "label", "x": 245, "y": 225, "symbol": "A", "fontSize": 16, "color": "#1a1a2e"},
                {"id": "t8s2_fuse", "type": "line", "x": 250, "y": 310, "length": 80, "rotation": 0, "color": "#f59e0b", "strokeWidth": 3},
                {"id": "t8s2_lf", "type": "text", "x": 255, "y": 325, "text": "Шнур (L = ?)", "fontSize": 12, "color": "#f59e0b"},
                {"id": "t8s2_flame", "type": "point", "x": 250, "y": 310, "color": "#ef4444", "radius": 5},
                {"id": "t8s2_lfl", "type": "text", "x": 225, "y": 335, "text": "Пламя", "fontSize": 11, "color": "#ef4444"},
            ],
        },
        3: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t8s3_a", "type": "body-circle", "x": 200, "y": 250, "color": "#3b82f6", "radius": 8},
                {"id": "t8s3_la", "type": "label", "x": 195, "y": 225, "symbol": "A", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t8s3_b", "type": "body-circle", "x": 600, "y": 250, "color": "#22c55e", "radius": 8},
                {"id": "t8s3_lb", "type": "label", "x": 595, "y": 225, "symbol": "B", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t8s3_lbt", "type": "text", "x": 575, "y": 270, "text": "Безопасно", "fontSize": 11, "color": "#22c55e"},
                {"id": "t8s3_run", "type": "vector", "x": 210, "y": 250, "length": 380, "rotation": 0, "color": "#3b82f6", "strokeWidth": 2},
                {"id": "t8s3_vr", "type": "text", "x": 370, "y": 225, "text": "Бег: v = 5 м/с", "fontSize": 12, "color": "#3b82f6"},
                {"id": "t8s3_fuse", "type": "line", "x": 200, "y": 310, "length": 80, "rotation": 0, "color": "#f59e0b", "strokeWidth": 3},
                {"id": "t8s3_flame", "type": "vector", "x": 200, "y": 310, "length": 80, "rotation": 0, "color": "#ef4444", "strokeWidth": 2},
                {"id": "t8s3_vf", "type": "text", "x": 210, "y": 325, "text": "Горение: 0,8 см/с", "fontSize": 12, "color": "#ef4444"},
            ],
        },
        4: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t8s4_a", "type": "point", "x": 200, "y": 250, "color": "#1a1a2e", "radius": 5},
                {"id": "t8s4_la", "type": "label", "x": 195, "y": 270, "symbol": "A", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t8s4_b", "type": "point", "x": 600, "y": 250, "color": "#1a1a2e", "radius": 5},
                {"id": "t8s4_lb", "type": "label", "x": 595, "y": 270, "symbol": "B", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t8s4_run_line", "type": "line", "x": 200, "y": 250, "length": 400, "rotation": 0, "color": "#3b82f6", "strokeWidth": 2},
                {"id": "t8s4_s", "type": "text", "x": 360, "y": 220, "text": "S = 300 м, v = 5 м/с", "fontSize": 13, "color": "#3b82f6"},
                {"id": "t8s4_fuse", "type": "line", "x": 200, "y": 310, "length": 80, "rotation": 0, "color": "#f59e0b", "strokeWidth": 3},
                {"id": "t8s4_fl", "type": "text", "x": 210, "y": 330, "text": "L = ?, v_пл = 0,8 см/с", "fontSize": 13, "color": "#f59e0b"},
                {"id": "t8s4_eq", "type": "text", "x": 300, "y": 370, "text": "t_бег = t_горения", "fontSize": 14, "color": "#64748b"},
            ],
        },
    },

    # ──────────────────────────────────────────────────────────────────
    # ЗАДАЧА 9: Средняя скорость самолёта (correct=928.57 км/ч)
    # ──────────────────────────────────────────────────────────────────
    9: {
        2: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t9s2_plane", "type": "body-circle", "x": 150, "y": 250, "color": "#3b82f6", "radius": 10},
                {"id": "t9s2_la", "type": "label", "x": 145, "y": 225, "symbol": "A", "fontSize": 16, "color": "#1a1a2e"},
                {"id": "t9s2_lp", "type": "text", "x": 125, "y": 270, "text": "Вылет", "fontSize": 12, "color": "#3b82f6"},
            ],
        },
        3: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t9s3_a", "type": "body-circle", "x": 150, "y": 250, "color": "#3b82f6", "radius": 8},
                {"id": "t9s3_la", "type": "label", "x": 145, "y": 225, "symbol": "A", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t9s3_m", "type": "point", "x": 400, "y": 250, "color": "#f59e0b", "radius": 6},
                {"id": "t9s3_lm", "type": "label", "x": 395, "y": 225, "symbol": "B", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t9s3_c", "type": "body-circle", "x": 650, "y": 250, "color": "#22c55e", "radius": 8},
                {"id": "t9s3_lc", "type": "label", "x": 645, "y": 225, "symbol": "C", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t9s3_lct", "type": "text", "x": 625, "y": 270, "text": "Прилёт", "fontSize": 12, "color": "#22c55e"},
                {"id": "t9s3_v1", "type": "vector", "x": 160, "y": 210, "length": 100, "rotation": 0, "color": "#3b82f6", "strokeWidth": 2},
                {"id": "t9s3_v1l", "type": "text", "x": 180, "y": 190, "text": "v₁ = 1000 км/ч", "fontSize": 11, "color": "#3b82f6"},
                {"id": "t9s3_v2", "type": "vector", "x": 410, "y": 210, "length": 80, "rotation": 0, "color": "#f59e0b", "strokeWidth": 2},
                {"id": "t9s3_v2l", "type": "text", "x": 420, "y": 190, "text": "v₂ = 850 км/ч", "fontSize": 11, "color": "#f59e0b"},
            ],
        },
        4: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t9s4_a", "type": "point", "x": 150, "y": 250, "color": "#1a1a2e", "radius": 5},
                {"id": "t9s4_la", "type": "label", "x": 145, "y": 270, "symbol": "A", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t9s4_m", "type": "point", "x": 400, "y": 250, "color": "#1a1a2e", "radius": 5},
                {"id": "t9s4_lm", "type": "label", "x": 395, "y": 270, "symbol": "B", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t9s4_c", "type": "point", "x": 600, "y": 250, "color": "#1a1a2e", "radius": 5},
                {"id": "t9s4_lc", "type": "label", "x": 595, "y": 270, "symbol": "C", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t9s4_l1", "type": "line", "x": 150, "y": 250, "length": 250, "rotation": 0, "color": "#3b82f6", "strokeWidth": 2},
                {"id": "t9s4_s1", "type": "text", "x": 225, "y": 215, "text": "S₁ = 2200 км, v₁ = 1000 км/ч", "fontSize": 12, "color": "#3b82f6"},
                {"id": "t9s4_l2", "type": "line", "x": 400, "y": 250, "length": 200, "rotation": 0, "color": "#f59e0b", "strokeWidth": 2},
                {"id": "t9s4_s2", "type": "text", "x": 440, "y": 215, "text": "S₂ = 1700 км, v₂ = 850 км/ч", "fontSize": 12, "color": "#f59e0b"},
                {"id": "t9s4_vsr", "type": "text", "x": 300, "y": 310, "text": "v_ср = (S₁+S₂) / (t₁+t₂) = ?", "fontSize": 13, "color": "#64748b"},
            ],
        },
    },

    # ──────────────────────────────────────────────────────────────────
    # ЗАДАЧА 10: Велосипед (correct≈2.76 м/с)
    # ──────────────────────────────────────────────────────────────────
    10: {
        2: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t10s2_cyclist", "type": "body-circle", "x": 200, "y": 300, "color": "#3b82f6", "radius": 10},
                {"id": "t10s2_la", "type": "label", "x": 195, "y": 275, "symbol": "A", "fontSize": 16, "color": "#1a1a2e"},
                {"id": "t10s2_lp", "type": "text", "x": 175, "y": 320, "text": "Старт (низ)", "fontSize": 12, "color": "#3b82f6"},
                {"id": "t10s2_hill", "type": "line", "x": 200, "y": 300, "length": 250, "rotation": -30, "color": "#94a3b8", "strokeWidth": 2},
                {"id": "t10s2_lh", "type": "text", "x": 350, "y": 200, "text": "Подъём", "fontSize": 12, "color": "#94a3b8"},
            ],
        },
        3: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t10s3_a", "type": "body-circle", "x": 200, "y": 300, "color": "#3b82f6", "radius": 6},
                {"id": "t10s3_la", "type": "label", "x": 195, "y": 275, "symbol": "A", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t10s3_b", "type": "body-circle", "x": 450, "y": 170, "color": "#f59e0b", "radius": 6},
                {"id": "t10s3_lb", "type": "label", "x": 445, "y": 148, "symbol": "B", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t10s3_lbt", "type": "text", "x": 455, "y": 170, "text": "Вершина", "fontSize": 12, "color": "#f59e0b"},
                {"id": "t10s3_up", "type": "line", "x": 200, "y": 300, "length": 280, "rotation": -28, "color": "#ef4444", "strokeWidth": 2},
                {"id": "t10s3_v1", "type": "text", "x": 280, "y": 210, "text": "v₁ = 6 км/ч", "fontSize": 12, "color": "#ef4444"},
                {"id": "t10s3_down", "type": "line", "x": 450, "y": 170, "length": 280, "rotation": 28, "color": "#22c55e", "strokeWidth": 2},
                {"id": "t10s3_v2", "type": "text", "x": 530, "y": 210, "text": "v₂ = 8 м/с", "fontSize": 12, "color": "#22c55e"},
                {"id": "t10s3_a2", "type": "body-circle", "x": 700, "y": 300, "color": "#3b82f6", "radius": 6},
                {"id": "t10s3_la2", "type": "label", "x": 695, "y": 275, "symbol": "A'", "fontSize": 14, "color": "#1a1a2e"},
            ],
        },
        4: {
            "width": 800, "height": 500,
            "elements": [
                {"id": "t10s4_a", "type": "point", "x": 150, "y": 300, "color": "#1a1a2e", "radius": 5},
                {"id": "t10s4_la", "type": "label", "x": 145, "y": 315, "symbol": "A", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t10s4_b", "type": "point", "x": 400, "y": 170, "color": "#1a1a2e", "radius": 5},
                {"id": "t10s4_lb", "type": "label", "x": 395, "y": 150, "symbol": "B", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t10s4_c", "type": "point", "x": 650, "y": 300, "color": "#1a1a2e", "radius": 5},
                {"id": "t10s4_lc", "type": "label", "x": 645, "y": 315, "symbol": "A'", "fontSize": 14, "color": "#1a1a2e"},
                {"id": "t10s4_up", "type": "line", "x": 150, "y": 300, "length": 280, "rotation": -28, "color": "#ef4444", "strokeWidth": 2},
                {"id": "t10s4_s1", "type": "text", "x": 220, "y": 210, "text": "S, v₁ = 6 км/ч ≈ 1,67 м/с", "fontSize": 12, "color": "#ef4444"},
                {"id": "t10s4_down", "type": "line", "x": 400, "y": 170, "length": 280, "rotation": 28, "color": "#22c55e", "strokeWidth": 2},
                {"id": "t10s4_s2", "type": "text", "x": 470, "y": 210, "text": "S, v₂ = 8 м/с", "fontSize": 12, "color": "#22c55e"},
                {"id": "t10s4_eq", "type": "text", "x": 280, "y": 360, "text": "S₁ = S₂ = S → v_ср = 2v₁v₂/(v₁+v₂)", "fontSize": 13, "color": "#64748b"},
            ],
        },
    },
}


def populate():
    updated = 0
    for task_id, steps in SCHEMAS.items():
        for step_order, schema_data in steps.items():
            step_obj = STEPS[step_order]
            try:
                tss = TaskSolutionStep.objects.get(task_id=task_id, step=step_obj)
                tss.schema_data = schema_data
                tss.save()
                updated += 1
                print(f"  [OK] task={task_id} step={step_order} -> {len(schema_data.get('elements', []))} elements")
            except TaskSolutionStep.DoesNotExist:
                print(f"  [SKIP] task={task_id} step={step_order} — no TaskSolutionStep")

    print(f"\nDone: {updated} schemas updated")


if __name__ == "__main__":
    populate()
