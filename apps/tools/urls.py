from django.urls import path
from . import views

app_name = 'tools'

urlpatterns = [
    path('', views.tool_list, name='list'),
    path('<uuid:pk>/', views.tool_detail, name='detail'),
    path('create/', views.tool_create, name='create'),
]