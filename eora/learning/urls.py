from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AuthLoginView,
    AuthLogoutView,
    AccountMeView,
    AccountChangePasswordView,
    CatalogViewSet, 
    KnowledgeSystemViewSet, 
    LearningSessionViewSet,
    TaskViewSet,
    TeacherFinalTaskReviewViewSet,
    OrganizerStudyGroupViewSet,
    TeacherPilotDashboardViewSet,
    TeacherPilotSessionViewSet,
    # Редактор схем
    SchemaElementCategoryViewSet,
    SchemaElementViewSet,
    SchemaTemplateViewSet,
    StudentSchemaViewSet,
    # Учитель — структура курса
    TeacherSectionViewSet,
    TeacherTopicViewSet,
    TeacherKnowledgeSystemFullViewSet,
    # Учитель — задачи
    TeacherTaskViewSet,
    TeacherKnowledgeSystemViewSet,
    TeacherTaskSolutionStepViewSet,
    csrf,
)

router = DefaultRouter()
router.register(r"catalog", CatalogViewSet, basename="catalog")
router.register(r"ks", KnowledgeSystemViewSet, basename="ks")
router.register(r"session", LearningSessionViewSet, basename="session")
router.register(r"task", TaskViewSet, basename="task")

# Редактор схем
router.register(r"schema-categories", SchemaElementCategoryViewSet, basename="schema-categories")
router.register(r"schema-elements", SchemaElementViewSet, basename="schema-elements")
router.register(r"schema-templates", SchemaTemplateViewSet, basename="schema-templates")
router.register(r"student-schemas", StudentSchemaViewSet, basename="student-schemas")

# API для учителя — структура курса
router.register(r"teacher/sections", TeacherSectionViewSet, basename="teacher-sections")
router.register(r"teacher/topics", TeacherTopicViewSet, basename="teacher-topics")
router.register(r"teacher/ks-full", TeacherKnowledgeSystemFullViewSet, basename="teacher-ks-full")

# API для учителя — задачи (старое)
router.register(r"teacher/tasks", TeacherTaskViewSet, basename="teacher-tasks")
router.register(r"teacher/ks", TeacherKnowledgeSystemViewSet, basename="teacher-ks")
router.register(r"teacher/task-solution-steps", TeacherTaskSolutionStepViewSet, basename="teacher-task-solution-steps")
router.register(r"teacher/final-reviews", TeacherFinalTaskReviewViewSet, basename="teacher-final-reviews")
router.register(r"organizer/study-groups", OrganizerStudyGroupViewSet, basename="organizer-study-groups")
router.register(r"teacher/pilot-dashboard", TeacherPilotDashboardViewSet, basename="teacher-pilot-dashboard")
router.register(r"teacher/pilot-sessions", TeacherPilotSessionViewSet, basename="teacher-pilot-sessions")

urlpatterns = [
    path("csrf/", csrf),
    path("auth/login/", AuthLoginView.as_view()),
    path("auth/logout/", AuthLogoutView.as_view()),
    path("account/me/", AccountMeView.as_view()),
    path("account/change-password/", AccountChangePasswordView.as_view()),
    path("", include(router.urls)),
]
