document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const canvas = document.getElementById('whiteboard');
    const ctx = canvas.getContext('2d');
    const strokeColorPicker = document.getElementById('stroke-color');
    const fillColorPicker = document.getElementById('fill-color');
    const strokeWidth = document.getElementById('stroke-width');
    const brushSizeDisplay = document.getElementById('brush-size-display');
    const clearButton = document.getElementById('clear-button');
    const deleteButton = document.getElementById('delete-button');
    const savePngButton = document.getElementById('save-png-button');
    const saveSvgButton = document.getElementById('save-svg-button');
    
    // Tool buttons
    const selectTool = document.getElementById('select-tool');
    const pathTool = document.getElementById('path-tool');
    const lineTool = document.getElementById('line-tool');
    const rectTool = document.getElementById('rect-tool');
    const ellipseTool = document.getElementById('ellipse-tool');
    
    // Zoom controls
    const zoomInButton = document.getElementById('zoom-in-button');
    const zoomOutButton = document.getElementById('zoom-out-button');
    const zoomResetButton = document.getElementById('zoom-reset-button');
    const zoomFitButton = document.getElementById('zoom-fit-button');
    const zoomDisplay = document.getElementById('zoom-display');
    
    // Grid control
    const gridToggleButton = document.getElementById('grid-toggle-button');
    let gridEnabled = false;
    
    // Vector objects storage
    let objects = [];
    let selectedObject = null;
    let activeObjectIndex = -1;
    let selectedTool = 'path';
    
    // Drawing state
    let isDrawing = false;
    let currentPath = [];
    let startPoint = { x: 0, y: 0 };
    let strokeColor = strokeColorPicker.value;
    let fillColor = fillColorPicker.value;
    let lineWidth = parseInt(strokeWidth.value);
    
    // Temporary shape for preview during drawing
    let tempShape = null;
    
    // Viewport state
    let viewportScale = 1;
    let viewportX = 0;
    let viewportY = 0;
    let isDraggingViewport = false;
    let lastPanPoint = { x: 0, y: 0 };
    
    // Resize canvas to fill container
    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Redraw canvas after resize
        render();
    }

    // Apply viewport transformations
    function applyViewportTransform() {
        ctx.save();
        ctx.translate(viewportX, viewportY);
        ctx.scale(viewportScale, viewportScale);
    }

    // Restore context after viewport transformations
    function restoreViewport() {
        ctx.restore();
    }

    // Convert screen coordinates to canvas coordinates
    function screenToCanvas(x, y) {
        return {
            x: (x - viewportX) / viewportScale,
            y: (y - viewportY) / viewportScale
        };
    }

    // Zoom the viewport
    function zoomViewport(factor, centerX, centerY) {
        const oldScale = viewportScale;
        
        // Remove upper limit for infinite zoom, keep a minimum to prevent zoom to zero
        // Exponential scaling gives smoother zoom experience at extreme levels
        viewportScale = Math.max(viewportScale * factor, 0.000001);
        
        // Adjust viewport position to zoom toward the center point
        if (centerX !== undefined && centerY !== undefined) {
            const beforeX = (centerX - viewportX) / oldScale;
            const beforeY = (centerY - viewportY) / oldScale;
            const afterX = beforeX * viewportScale;
            const afterY = beforeY * viewportScale;
            viewportX -= (afterX - beforeX * oldScale);
            viewportY -= (afterY - beforeY * oldScale);
        }
        
        // Update zoom display with appropriate formatting for extreme values
        updateZoomDisplay();
        
        render();
    }

    // Update zoom display with appropriate formatting
    function updateZoomDisplay() {
        let zoomPercentage = viewportScale * 100;
        
        if (zoomPercentage >= 10000) {
            zoomDisplay.textContent = `${Math.round(zoomPercentage / 1000)}k%`;
        } else if (zoomPercentage >= 1000) {
            zoomDisplay.textContent = `${(zoomPercentage / 1000).toFixed(1)}k%`;
        } else if (zoomPercentage < 1) {
            zoomDisplay.textContent = `${zoomPercentage.toFixed(2)}%`;
        } else if (zoomPercentage < 10) {
            zoomDisplay.textContent = `${zoomPercentage.toFixed(1)}%`;
        } else {
            zoomDisplay.textContent = `${Math.round(zoomPercentage)}%`;
        }
    }

    // Fit content to view
    function fitContentToView() {
        if (objects.length === 0) {
            resetViewport();
            return;
        }
        
        // Find bounds of all objects
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        objects.forEach(obj => {
            const bounds = obj.getBounds();
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });
        
        // Add padding
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        // Calculate scale to fit
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const scaleX = canvas.width / contentWidth;
        const scaleY = canvas.height / contentHeight;
        viewportScale = Math.min(scaleX, scaleY);
        
        // Center content
        viewportX = canvas.width / 2 - (minX + contentWidth / 2) * viewportScale;
        viewportY = canvas.height / 2 - (minY + contentHeight / 2) * viewportScale;
        
        // Update zoom display
        updateZoomDisplay();
        
        render();
    }

    // Reset viewport to default
    function resetViewport() {
        viewportScale = 1;
        viewportX = 0;
        viewportY = 0;
        updateZoomDisplay();
        render();
    }

    // Shape classes
    class Shape {
        constructor(type, strokeColor, fillColor, strokeWidth) {
            this.type = type;
            this.strokeColor = strokeColor;
            this.fillColor = fillColor;
            this.strokeWidth = strokeWidth;
            this.id = Date.now() + Math.random().toString(16).slice(2);
            this.isSelected = false;
        }
        
        draw(ctx) {
            // Base draw method to be overridden
        }
        
        isPointInside(x, y) {
            // Base hit test method to be overridden
            return false;
        }
        
        drawSelectionBox(ctx) {
            if (!this.isSelected) return;
            
            const bounds = this.getBounds();
            ctx.strokeStyle = '#4285f4';
            
            // Adjust line width and dash pattern based on zoom level
            const inverseScale = 1 / viewportScale;
            const lineWidth = Math.min(2 * inverseScale, 2);
            const dashSize = Math.min(5 * inverseScale, 5);
            
            ctx.lineWidth = lineWidth;
            ctx.setLineDash([dashSize, dashSize]);
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.setLineDash([]);
            
            // Draw handles with appropriate size for zoom level
            const handleSize = Math.min(8 * inverseScale, 8);
            ctx.fillStyle = 'white';
            ctx.strokeStyle = '#4285f4';
            ctx.lineWidth = lineWidth * 0.5;
            
            // Corner handles
            [
                { x: bounds.x, y: bounds.y },
                { x: bounds.x + bounds.width, y: bounds.y },
                { x: bounds.x, y: bounds.y + bounds.height },
                { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
            ].forEach(p => {
                ctx.beginPath();
                ctx.rect(p.x - handleSize/2, p.y - handleSize/2, handleSize, handleSize);
                ctx.fill();
                ctx.stroke();
            });
        }
    }
    
    class Path extends Shape {
        constructor(points, strokeColor, fillColor, strokeWidth) {
            super('path', strokeColor, fillColor, strokeWidth);
            this.points = points.slice();
        }
        
        draw(ctx) {
            if (this.points.length < 2) return;
            
            ctx.beginPath();
            ctx.moveTo(this.points[0].x, this.points[0].y);
            
            for (let i = 1; i < this.points.length; i++) {
                ctx.lineTo(this.points[i].x, this.points[i].y);
            }
            
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.strokeWidth;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.stroke();
        }
        
        isPointInside(x, y) {
            if (this.points.length < 2) return false;
            
            // Check if point is near any segment of the path
            const threshold = this.strokeWidth + 5;
            
            for (let i = 0; i < this.points.length - 1; i++) {
                const p1 = this.points[i];
                const p2 = this.points[i + 1];
                
                // Calculate distance from point to line segment
                const d = distanceToSegment({x, y}, p1, p2);
                if (d <= threshold) return true;
            }
            
            return false;
        }
        
        getBounds() {
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            this.points.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
            
            return {
                x: minX - this.strokeWidth/2,
                y: minY - this.strokeWidth/2,
                width: (maxX - minX) + this.strokeWidth,
                height: (maxY - minY) + this.strokeWidth
            };
        }
    }
    
    class Line extends Shape {
        constructor(x1, y1, x2, y2, strokeColor, fillColor, strokeWidth) {
            super('line', strokeColor, fillColor, strokeWidth);
            this.x1 = x1;
            this.y1 = y1;
            this.x2 = x2;
            this.y2 = y2;
        }
        
        draw(ctx) {
            ctx.beginPath();
            ctx.moveTo(this.x1, this.y1);
            ctx.lineTo(this.x2, this.y2);
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.strokeWidth;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
        
        isPointInside(x, y) {
            // Check if point is near the line
            const d = distanceToSegment({x, y}, {x: this.x1, y: this.y1}, {x: this.x2, y: this.y2});
            return d <= (this.strokeWidth + 5);
        }
        
        getBounds() {
            const minX = Math.min(this.x1, this.x2);
            const minY = Math.min(this.y1, this.y2);
            const maxX = Math.max(this.x1, this.x2);
            const maxY = Math.max(this.y1, this.y2);
            
            return {
                x: minX - this.strokeWidth/2,
                y: minY - this.strokeWidth/2,
                width: (maxX - minX) + this.strokeWidth,
                height: (maxY - minY) + this.strokeWidth
            };
        }
    }
    
    class Rectangle extends Shape {
        constructor(x, y, width, height, strokeColor, fillColor, strokeWidth) {
            super('rectangle', strokeColor, fillColor, strokeWidth);
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
        }
        
        draw(ctx) {
            ctx.beginPath();
            ctx.rect(this.x, this.y, this.width, this.height);
            
            if (this.fillColor) {
                ctx.fillStyle = this.fillColor;
                ctx.fill();
            }
            
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.strokeWidth;
            ctx.stroke();
        }
        
        isPointInside(x, y) {
            const threshold = this.strokeWidth + 5;
            
            // Check if point is inside filled rectangle
            if (this.fillColor !== 'transparent' && this.fillColor !== '#ffffff') {
                if (x >= this.x && x <= this.x + this.width && 
                    y >= this.y && y <= this.y + this.height) {
                    return true;
                }
            }
            
            // Check if point is near any edge
            const nearTop = Math.abs(y - this.y) <= threshold && 
                            x >= this.x - threshold && x <= this.x + this.width + threshold;
                            
            const nearBottom = Math.abs(y - (this.y + this.height)) <= threshold && 
                               x >= this.x - threshold && x <= this.x + this.width + threshold;
                               
            const nearLeft = Math.abs(x - this.x) <= threshold && 
                             y >= this.y - threshold && y <= this.y + this.height + threshold;
                             
            const nearRight = Math.abs(x - (this.x + this.width)) <= threshold && 
                              y >= this.y - threshold && y <= this.y + this.height + threshold;
            
            return nearTop || nearBottom || nearLeft || nearRight;
        }
        
        getBounds() {
            return {
                x: this.x - this.strokeWidth/2,
                y: this.y - this.strokeWidth/2,
                width: this.width + this.strokeWidth,
                height: this.height + this.strokeWidth
            };
        }
    }
    
    class Ellipse extends Shape {
        constructor(x, y, radiusX, radiusY, strokeColor, fillColor, strokeWidth) {
            super('ellipse', strokeColor, fillColor, strokeWidth);
            this.x = x;
            this.y = y;
            this.radiusX = radiusX;
            this.radiusY = radiusY;
        }
        
        draw(ctx) {
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.radiusX, this.radiusY, 0, 0, Math.PI * 2);
            
            if (this.fillColor) {
                ctx.fillStyle = this.fillColor;
                ctx.fill();
            }
            
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.strokeWidth;
            ctx.stroke();
        }
        
        isPointInside(x, y) {
            const threshold = this.strokeWidth + 5;
            
            // For ellipse, compute normalized distance from center
            const normalizedX = (x - this.x) / (this.radiusX + threshold);
            const normalizedY = (y - this.y) / (this.radiusY + threshold);
            const distance = normalizedX * normalizedX + normalizedY * normalizedY;
            
            // If shape is filled and point is inside
            if (this.fillColor !== 'transparent' && this.fillColor !== '#ffffff') {
                const fillNormalizedX = (x - this.x) / this.radiusX;
                const fillNormalizedY = (y - this.y) / this.radiusY;
                const fillDistance = fillNormalizedX * fillNormalizedX + fillNormalizedY * fillNormalizedY;
                if (fillDistance <= 1) return true;
            }
            
            // Check if point is near the edge of the ellipse
            return Math.abs(distance - 1) <= 0.2;
        }
        
        getBounds() {
            return {
                x: this.x - this.radiusX - this.strokeWidth/2,
                y: this.y - this.radiusY - this.strokeWidth/2,
                width: this.radiusX * 2 + this.strokeWidth,
                height: this.radiusY * 2 + this.strokeWidth
            };
        }
    }
    
    // Utility functions
    function distanceToSegment(p, v, w) {
        const len2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
        if (len2 === 0) return Math.sqrt((p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y));
        
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / len2;
        t = Math.max(0, Math.min(1, t));
        
        const nearestX = v.x + t * (w.x - v.x);
        const nearestY = v.y + t * (w.y - v.y);
        
        return Math.sqrt((p.x - nearestX) * (p.x - nearestX) + (p.y - nearestY) * (p.y - nearestY));
    }
    
    // Render all objects
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Apply viewport transformations
        applyViewportTransform();
        
        // Draw grid at appropriate zoom levels for orientation
        drawGrid();
        
        // Optimization: Only draw objects that are potentially in view
        const visibleBounds = {
            x: -viewportX / viewportScale,
            y: -viewportY / viewportScale,
            width: canvas.width / viewportScale,
            height: canvas.height / viewportScale
        };
        
        objects.forEach(obj => {
            // Skip rendering objects that are completely outside the viewport
            const objBounds = obj.getBounds();
            if (objBounds.x > visibleBounds.x + visibleBounds.width ||
                objBounds.y > visibleBounds.y + visibleBounds.height ||
                objBounds.x + objBounds.width < visibleBounds.x ||
                objBounds.y + objBounds.height < visibleBounds.y) {
                return;
            }
            
            obj.draw(ctx);
        });
        
        // Draw temporary shape during drawing
        if (tempShape) {
            tempShape.draw(ctx);
        }
        
        // Draw selection box for selected object
        if (selectedObject) {
            selectedObject.drawSelectionBox(ctx);
        }
        
        // Restore context
        restoreViewport();
        
        // Draw zoom indicator when extremely zoomed in or out
        drawZoomIndicator();
    }

    // Draw a grid to help with orientation and alignment
    function drawGrid() {
        // Only draw grid when zoom level is appropriate or grid is explicitly enabled
        if (gridEnabled || viewportScale < 0.05 || viewportScale > 20) {
            const gridSize = getAppropriateGridSize();
            const xStart = Math.floor((-viewportX) / viewportScale / gridSize) * gridSize;
            const yStart = Math.floor((-viewportY) / viewportScale / gridSize) * gridSize;
            const xEnd = xStart + (canvas.width / viewportScale / gridSize + 2) * gridSize;
            const yEnd = yStart + (canvas.height / viewportScale / gridSize + 2) * gridSize;
            
            // Adjust grid opacity based on whether it's enabled or automatic
            ctx.strokeStyle = gridEnabled ? 
                'rgba(200, 200, 200, 0.4)' : 
                'rgba(200, 200, 200, 0.2)';
                
            ctx.lineWidth = 0.5 / viewportScale;
            
            // Draw vertical lines
            for (let x = xStart; x <= xEnd; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, yStart);
                ctx.lineTo(x, yEnd);
                ctx.stroke();
            }
            
            // Draw horizontal lines
            for (let y = yStart; y <= yEnd; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(xStart, y);
                ctx.lineTo(xEnd, y);
                ctx.stroke();
            }
        }
    }

    // Determine appropriate grid size based on zoom level
    function getAppropriateGridSize() {
        if (viewportScale < 0.001) return 10000;
        if (viewportScale < 0.01) return 1000;
        if (viewportScale < 0.1) return 100;
        if (viewportScale < 1) return 50;
        if (viewportScale > 100) return 0.1;
        if (viewportScale > 50) return 0.2;
        if (viewportScale > 20) return 0.5;
        if (viewportScale > 10) return 1;
        return 10;
    }

    // Draw zoom indicator to show current state
    function drawZoomIndicator() {
        // Only show indicator at extreme zoom levels
        if (viewportScale > 20 || viewportScale < 0.1) {
            const padding = 10;
            const width = 150;
            const height = 30;
            const x = canvas.width - width - padding;
            const y = canvas.height - height - padding;
            
            // Draw background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(x, y, width, height);
            
            // Display zoom level
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`Zoom: ${zoomDisplay.textContent}`, x + width/2, y + height/2);
        }
    }

    // Toggle grid visibility
    function toggleGrid() {
        gridEnabled = !gridEnabled;
        gridToggleButton.classList.toggle('active', gridEnabled);
        render();
    }

    // Handle tool selection
    function selectActiveTool(tool) {
        selectedTool = tool;
        
        // Update UI
        selectTool.classList.remove('active');
        pathTool.classList.remove('active');
        lineTool.classList.remove('active');
        rectTool.classList.remove('active');
        ellipseTool.classList.remove('active');
        
        switch (tool) {
            case 'select':
                selectTool.classList.add('active');
                canvas.className = 'cursor-select';
                break;
            case 'path':
                pathTool.classList.add('active');
                canvas.className = 'cursor-path';
                break;
            case 'line':
                lineTool.classList.add('active');
                canvas.className = 'cursor-line';
                break;
            case 'rectangle':
                rectTool.classList.add('active');
                canvas.className = 'cursor-rect';
                break;
            case 'ellipse':
                ellipseTool.classList.add('active');
                canvas.className = 'cursor-ellipse';
                break;
        }
        
        // Deselect when switching tools
        if (selectedObject) {
            selectedObject.isSelected = false;
            selectedObject = null;
            render();
        }
    }

    // Initialize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Update stroke width display
    strokeWidth.addEventListener('input', () => {
        lineWidth = parseInt(strokeWidth.value);
        brushSizeDisplay.textContent = `${lineWidth}px`;
    });

    // Update stroke color
    strokeColorPicker.addEventListener('input', () => {
        strokeColor = strokeColorPicker.value;
        if (selectedObject) {
            selectedObject.strokeColor = strokeColor;
            render();
        }
    });
    
    // Update fill color
    fillColorPicker.addEventListener('input', () => {
        fillColor = fillColorPicker.value;
        if (selectedObject) {
            selectedObject.fillColor = fillColor;
            render();
        }
    });
    
    // Tool button events
    selectTool.addEventListener('click', () => selectActiveTool('select'));
    pathTool.addEventListener('click', () => selectActiveTool('path'));
    lineTool.addEventListener('click', () => selectActiveTool('line'));
    rectTool.addEventListener('click', () => selectActiveTool('rectangle'));
    ellipseTool.addEventListener('click', () => selectActiveTool('ellipse'));
    
    // Keyboard shortcuts for tools
    let isSpaceDown = false;
    
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return; // Skip if typing in input fields
        
        if (e.code === 'Space') {
            isSpaceDown = true;
            canvas.style.cursor = 'grab';
        }
        
        switch (e.key.toLowerCase()) {
            case 'v': selectActiveTool('select'); break;
            case 'p': selectActiveTool('path'); break;
            case 'l': selectActiveTool('line'); break;
            case 'r': selectActiveTool('rectangle'); break;
            case 'e': selectActiveTool('ellipse'); break;
            case 'g': toggleGrid(); break; // Added grid toggle shortcut
            case 'delete': case 'backspace': 
                if (selectedObject) {
                    const index = objects.findIndex(obj => obj.id === selectedObject.id);
                    if (index !== -1) {
                        objects.splice(index, 1);
                        selectedObject = null;
                        render();
                    }
                }
                break;
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            isSpaceDown = false;
            if (!isDraggingViewport) {
                canvas.style.cursor = `cursor-${selectedTool}`;
            }
        }
    });
    
    // Find object under point
    function findObjectUnderPoint(x, y) {
        // Search in reverse order (top to bottom)
        for (let i = objects.length - 1; i >= 0; i--) {
            if (objects[i].isPointInside(x, y)) {
                return { object: objects[i], index: i };
            }
        }
        return null;
    }
    
    // Get mouse coordinates relative to canvas
    function getMouseCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        return screenToCanvas(screenX, screenY);
    }
    
    // Drawing functions based on selected tool
    function startDrawing(e) {
        const coords = getMouseCoords(e);
        
        switch (selectedTool) {
            case 'select':
                const found = findObjectUnderPoint(coords.x, coords.y);
                
                // Deselect previous object
                if (selectedObject) {
                    selectedObject.isSelected = false;
                }
                
                // Select new object if found
                if (found) {
                    selectedObject = found.object;
                    selectedObject.isSelected = true;
                    activeObjectIndex = found.index;
                    
                    // Update color pickers to match selected object
                    strokeColorPicker.value = selectedObject.strokeColor;
                    if (selectedObject.fillColor && selectedObject.fillColor !== 'transparent') {
                        fillColorPicker.value = selectedObject.fillColor;
                    }
                    strokeWidth.value = selectedObject.strokeWidth;
                    brushSizeDisplay.textContent = `${selectedObject.strokeWidth}px`;
                } else {
                    selectedObject = null;
                    activeObjectIndex = -1;
                }
                render();
                break;
                
            case 'path':
                isDrawing = true;
                currentPath = [{ x: coords.x, y: coords.y }];
                tempShape = new Path(currentPath, strokeColor, 'transparent', lineWidth);
                break;
                
            case 'line':
                isDrawing = true;
                startPoint = { x: coords.x, y: coords.y };
                tempShape = new Line(coords.x, coords.y, coords.x, coords.y, strokeColor, 'transparent', lineWidth);
                break;
                
            case 'rectangle':
                isDrawing = true;
                startPoint = { x: coords.x, y: coords.y };
                tempShape = new Rectangle(coords.x, coords.y, 0, 0, strokeColor, fillColor, lineWidth);
                break;
                
            case 'ellipse':
                isDrawing = true;
                startPoint = { x: coords.x, y: coords.y };
                tempShape = new Ellipse(coords.x, coords.y, 0, 0, strokeColor, fillColor, lineWidth);
                break;
        }
    }
    
    function draw(e) {
        if (!isDrawing) return;
        
        const coords = getMouseCoords(e);
        
        switch (selectedTool) {
            case 'path':
                currentPath.push({ x: coords.x, y: coords.y });
                tempShape = new Path(currentPath, strokeColor, 'transparent', lineWidth);
                break;
                
            case 'line':
                tempShape = new Line(startPoint.x, startPoint.y, coords.x, coords.y, 
                                      strokeColor, 'transparent', lineWidth);
                break;
                
            case 'rectangle':
                const rectWidth = coords.x - startPoint.x;
                const rectHeight = coords.y - startPoint.y;
                const rectX = rectWidth >= 0 ? startPoint.x : coords.x;
                const rectY = rectHeight >= 0 ? startPoint.y : coords.y;
                tempShape = new Rectangle(rectX, rectY, Math.abs(rectWidth), Math.abs(rectHeight), 
                                         strokeColor, fillColor, lineWidth);
                break;
                
            case 'ellipse':
                const radiusX = Math.abs(coords.x - startPoint.x);
                const radiusY = Math.abs(coords.y - startPoint.y);
                const centerX = startPoint.x;
                const centerY = startPoint.y;
                tempShape = new Ellipse(centerX, centerY, radiusX, radiusY, 
                                        strokeColor, fillColor, lineWidth);
                break;
        }
        
        render();
    }
    
    function stopDrawing() {
        if (!isDrawing) return;
        
        // Add the finished shape to objects array
        if (tempShape) {
            objects.push(tempShape);
            tempShape = null;
        }
        
        isDrawing = false;
        currentPath = [];
        render();
    }
    
    // Mouse events
    canvas.addEventListener('mousedown', (e) => {
        // Middle mouse button or space+left click for panning
        if (e.button === 1 || (isSpaceDown && e.button === 0)) {
            e.preventDefault();
            isDraggingViewport = true;
            lastPanPoint = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        } else if (!isSpaceDown) {
            startDrawing(e);
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isDraggingViewport) {
            const dx = e.clientX - lastPanPoint.x;
            const dy = e.clientY - lastPanPoint.y;
            viewportX += dx;
            viewportY += dy;
            lastPanPoint = { x: e.clientX, y: e.clientY };
            render();
        } else if (!isSpaceDown) {
            draw(e);
        }
    });
    
    canvas.addEventListener('mouseup', (e) => {
        if (isDraggingViewport) {
            isDraggingViewport = false;
            canvas.style.cursor = isSpaceDown ? 'grab' : `cursor-${selectedTool}`;
        } else if (!isSpaceDown) {
            stopDrawing();
        }
    });
    
    canvas.addEventListener('mouseleave', (e) => {
        if (isDraggingViewport) {
            isDraggingViewport = false;
            canvas.style.cursor = isSpaceDown ? 'grab' : `cursor-${selectedTool}`;
        } else {
            stopDrawing();
        }
    });
    
    // Touch events
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        startDrawing(mouseEvent);
    });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        draw(mouseEvent);
    });
    
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        stopDrawing();
    });
    
    // Zoom with mouse wheel
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Adjust scaling factor based on current zoom for smoother experience
        // For extreme zoom levels, use a more granular factor
        let factor;
        if (e.deltaY < 0) { // Zoom in
            factor = viewportScale < 0.1 ? 1.05 : 1.1;
        } else { // Zoom out
            factor = viewportScale < 0.1 ? 0.95 : 0.9;
        }
        
        zoomViewport(factor, mouseX, mouseY);
    });
    
    // Clear button
    clearButton.addEventListener('click', () => {
        objects = [];
        selectedObject = null;
        activeObjectIndex = -1;
        render();
    });
    
    // Delete button
    deleteButton.addEventListener('click', () => {
        if (selectedObject) {
            const index = objects.findIndex(obj => obj.id === selectedObject.id);
            if (index !== -1) {
                objects.splice(index, 1);
                selectedObject = null;
                activeObjectIndex = -1;
                render();
            }
        }
    });
    
    // Save as PNG
    savePngButton.addEventListener('click', () => {
        // Temporarily hide selection box
        if (selectedObject) {
            selectedObject.isSelected = false;
            render();
            selectedObject.isSelected = true;
        }
        
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'whiteboard-drawing.png';
        link.href = dataURL;
        link.click();
        
        // Restore selection box if needed
        if (selectedObject) {
            render();
        }
    });
    
    // Save as SVG
    saveSvgButton.addEventListener('click', () => {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', canvas.width);
        svg.setAttribute('height', canvas.height);
        svg.setAttribute('xmlns', svgNS);
        
        // Convert canvas objects to SVG elements
        objects.forEach(obj => {
            let element;
            
            switch (obj.type) {
                case 'path':
                    if (obj.points.length < 2) return;
                    
                    element = document.createElementNS(svgNS, 'polyline');
                    const pointsStr = obj.points.map(p => `${p.x},${p.y}`).join(' ');
                    element.setAttribute('points', pointsStr);
                    element.setAttribute('fill', 'none');
                    element.setAttribute('stroke', obj.strokeColor);
                    element.setAttribute('stroke-width', obj.strokeWidth);
                    element.setAttribute('stroke-linejoin', 'round');
                    element.setAttribute('stroke-linecap', 'round');
                    break;
                    
                case 'line':
                    element = document.createElementNS(svgNS, 'line');
                    element.setAttribute('x1', obj.x1);
                    element.setAttribute('y1', obj.y1);
                    element.setAttribute('x2', obj.x2);
                    element.setAttribute('y2', obj.y2);
                    element.setAttribute('stroke', obj.strokeColor);
                    element.setAttribute('stroke-width', obj.strokeWidth);
                    element.setAttribute('stroke-linecap', 'round');
                    break;
                    
                case 'rectangle':
                    element = document.createElementNS(svgNS, 'rect');
                    element.setAttribute('x', obj.x);
                    element.setAttribute('y', obj.y);
                    element.setAttribute('width', obj.width);
                    element.setAttribute('height', obj.height);
                    if (obj.fillColor !== 'transparent') {
                        element.setAttribute('fill', obj.fillColor);
                    } else {
                        element.setAttribute('fill', 'none');
                    }
                    element.setAttribute('stroke', obj.strokeColor);
                    element.setAttribute('stroke-width', obj.strokeWidth);
                    break;
                    
                case 'ellipse':
                    element = document.createElementNS(svgNS, 'ellipse');
                    element.setAttribute('cx', obj.x);
                    element.setAttribute('cy', obj.y);
                    element.setAttribute('rx', obj.radiusX);
                    element.setAttribute('ry', obj.radiusY);
                    if (obj.fillColor !== 'transparent') {
                        element.setAttribute('fill', obj.fillColor);
                    } else {
                        element.setAttribute('fill', 'none');
                    }
                    element.setAttribute('stroke', obj.strokeColor);
                    element.setAttribute('stroke-width', obj.strokeWidth);
                    break;
            }
            
            if (element) {
                svg.appendChild(element);
            }
        });
        
        // Convert SVG to data URL
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(svg);
        const svgBlob = new Blob([svgStr], {type: 'image/svg+xml;charset=utf-8'});
        const svgUrl = URL.createObjectURL(svgBlob);
        
        // Download SVG
        const link = document.createElement('a');
        link.download = 'whiteboard-drawing.svg';
        link.href = svgUrl;
        link.click();
        
        // Cleanup
        URL.revokeObjectURL(svgUrl);
    });
    
    // Zoom button controls
    zoomInButton.addEventListener('click', () => zoomViewport(1.1, canvas.width/2, canvas.height/2));
    zoomOutButton.addEventListener('click', () => zoomViewport(0.9, canvas.width/2, canvas.height/2));
    zoomResetButton.addEventListener('click', resetViewport);
    zoomFitButton.addEventListener('click', fitContentToView);
    
    // Grid toggle button event
    gridToggleButton.addEventListener('click', toggleGrid);
    
    // Initialize with path tool selected and reset viewport
    selectActiveTool('path');
    resetViewport();
});
