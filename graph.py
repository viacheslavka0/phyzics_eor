# make_full_erd.py
from graphviz import Digraph

# Все таблицы с ключевыми полями
# Формат: "TableName": ("Название", ["PK", "FK", "атрибут1", "атрибут2", ...])
ENTITIES = {
    "User": ("Пользователь", ["id (PK)", "username", "email"]),
    "SchoolClass": ("SchoolClass", ["id (PK)", "number", "title"]),
    "SubjectSection": ("SubjectSection", ["id (PK)", "school_class_id (FK)", "title", "order"]),
    "Topic": ("Topic", ["id (PK)", "section_id (FK)", "title", "order"]),
    "KnowledgeSystem": ("KnowledgeSystem", ["id (PK)", "topic_id (FK)", "title", "comprehension_image", "comprehension_pass_threshold"]),
    "KSZone": ("KSZone", ["id (PK)", "ks_id (FK)", "x", "y", "width", "height", "label"]),
    "KSQuestion": ("KSQuestion", ["id (PK)", "ks_id (FK)", "type", "text", "options", "correct_answer_text"]),
    "KSCloze": ("KSCloze", ["id (PK)", "ks_id (FK)", "original_text", "marked_text", "blanks", "distractors"]),
    "ComprehensionAttempt": ("ComprehensionAttempt", ["id (PK)", "session_id (FK)", "total_questions", "correct_answers", "score_percent", "passed"]),
    "QuestionAnswer": ("QuestionAnswer", ["id (PK)", "attempt_id (FK)", "question_id (FK)", "answer_text", "is_correct"]),
    "ClozeAnswer": ("ClozeAnswer", ["id (PK)", "attempt_id (FK)", "cloze_id (FK)", "answers", "score", "is_correct"]),
    "SolutionMethod": ("SolutionMethod", ["id (PK)", "ks_id (FK)", "title", "description"]),
    "SolutionStep": ("SolutionStep", ["id (PK)", "method_id (FK)", "order", "title", "description"]),
    "Task": ("Task", ["id (PK)", "ks_id (FK)", "title", "text", "correct_answer", "difficulty"]),
    "TaskSolutionStep": ("TaskSolutionStep", ["id (PK)", "task_id (FK)", "step_id (FK)", "content"]),
    "SchemaElementCategory": ("SchemaElementCategory", ["id (PK)", "name", "slug", "order"]),
    "SchemaElement": ("SchemaElement", ["id (PK)", "category_id (FK)", "name", "svg_template", "default_props"]),
    "SchemaTemplate": ("SchemaTemplate", ["id (PK)", "task_id (FK)", "template_type", "data"]),
    "StudentSchema": ("StudentSchema", ["id (PK)", "task_attempt_id (FK)", "step_id (FK)", "data", "similarity_score"]),
    "LearningSession": ("LearningSession", ["id (PK)", "user_id (FK)", "ks_id (FK)", "current_stage", "comprehension_passed", "score_percent"]),
    "TaskAttempt": ("TaskAttempt", ["id (PK)", "session_id (FK)", "task_id (FK)", "answer_numeric", "is_correct", "schema_data"]),
    "StepAttempt": ("StepAttempt", ["id (PK)", "task_attempt_id (FK)", "step_id (FK)", "student_answer"]),
    "EventLog": ("EventLog", ["id (PK)", "user_id (FK)", "session_id (FK)", "event", "payload", "ts"]),
}

# Основные связи по ForeignKey / OneToOne / ManyToMany
# Формат: (from, to, label)
RELATIONS = [
    # Иерархия курса
    ("SchoolClass", "SubjectSection", "1 : N"),
    ("SubjectSection", "Topic", "1 : N"),
    ("Topic", "KnowledgeSystem", "1 : N"),

    # Осмысление СК
    ("KnowledgeSystem", "KSZone", "1 : N"),
    ("KnowledgeSystem", "KSQuestion", "1 : N"),
    ("KnowledgeSystem", "KSCloze", "1 : N"),

    # ComprehensionAttempt и ответы
    ("LearningSession", "ComprehensionAttempt", "1 : N"),
    ("ComprehensionAttempt", "QuestionAnswer", "1 : N"),
    ("ComprehensionAttempt", "ClozeAnswer", "1 : N"),
    ("KSQuestion", "QuestionAnswer", "1 : N"),
    ("KSCloze", "ClozeAnswer", "1 : N"),

    # Метод решения
    ("KnowledgeSystem", "SolutionMethod", "1 : 1"),
    ("SolutionMethod", "SolutionStep", "1 : N"),

    # Задачи
    ("KnowledgeSystem", "Task", "1 : N"),
    ("Task", "TaskSolutionStep", "1 : N"),
    ("SolutionStep", "TaskSolutionStep", "1 : N"),

    # Редактор схем
    ("SchemaElementCategory", "SchemaElement", "1 : N"),
    ("SchemaElement", "SchemaTemplate", "N : N? (через JSON)"),  # логическая связь
    ("Task", "SchemaTemplate", "1 : N"),
    ("TaskAttempt", "StudentSchema", "1 : N"),
    ("SolutionStep", "StudentSchema", "1 : N?"),
    
    # Сессии и попытки
    ("User", "LearningSession", "1 : N"),
    ("KnowledgeSystem", "LearningSession", "1 : N"),
    ("LearningSession", "TaskAttempt", "1 : N"),
    ("Task", "TaskAttempt", "1 : N"),
    ("TaskAttempt", "StepAttempt", "1 : N"),
    ("SolutionStep", "StepAttempt", "1 : N"),

    # Логирование
    ("User", "EventLog", "1 : N"),
    ("LearningSession", "EventLog", "1 : N"),

    # Many-to-Many KSQuestion <-> KSZone
    ("KSQuestion", "KSZone", "M : N"),
]

def build_graph():
    g = Digraph("EOR_FULL_ERD", filename="eor_full_erd", format="png")
    g.attr(rankdir="LR", fontsize="9", fontname="Arial")

    # Узлы с полями
    for key, (label, fields) in ENTITIES.items():
        # Формируем строку с полями
        fields_str = "|".join(fields)
        # Создаём узел в формате record: заголовок (жирный через специальный формат) | поля
        # В Graphviz record формат: {label}|{field1|field2|...}
        node_label = f"{{{label}}}|{{{fields_str}}}"
        
        g.node(
            key,
            node_label,
            shape="record",
            style="filled",
            fillcolor="lightgrey",
            fontname="Arial"
        )

    # Рёбра
    for src, dst, rel_label in RELATIONS:
        g.edge(
            src,
            dst,
            label=rel_label,
            fontsize="8",
            fontname="Arial"
        )

    return g

if __name__ == "__main__":
    graph = build_graph()
    graph.render(cleanup=True)
    print("Схема сохранена в файле eor_full_erd.png")