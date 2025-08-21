from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import Tool, ToolCategory


def tool_list(request):
    """List all available tools"""
    tools = Tool.objects.filter(is_available=True).select_related('owner', 'category')
    categories = ToolCategory.objects.all()
    
    # Filter by category if provided
    category_slug = request.GET.get('category')
    if category_slug:
        tools = tools.filter(category__slug=category_slug)
    
    # Search functionality
    search = request.GET.get('search')
    if search:
        tools = tools.filter(title__icontains=search)
    
    context = {
        'tools': tools,
        'categories': categories,
        'selected_category': category_slug,
        'search_query': search,
    }
    return render(request, 'tools/list.html', context)


def tool_detail(request, pk):
    """Tool detail view"""
    tool = get_object_or_404(Tool, pk=pk)
    context = {
        'tool': tool,
    }
    return render(request, 'tools/detail.html', context)


@login_required
def tool_create(request):
    """Create a new tool listing"""
    if request.method == 'POST':
        # Handle form submission (placeholder)
        messages.success(request, 'Tool listed successfully!')
        return redirect('tools:list')
    
    categories = ToolCategory.objects.all()
    context = {
        'categories': categories,
    }
    return render(request, 'tools/create.html', context)
