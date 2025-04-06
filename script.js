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
    
    // Resize canvas to fill container
    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Redraw canvas after resize
        render();
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
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.setLineDash([]);
            
            // Draw handles
            const handleSize = 8;
            ctx.fillStyle = 'white';
            ctx.strokeStyle = '#4285f4';
            ctx.lineWidth = 1;
            
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
        
        // Draw all objects
        objects.forEach(obj => {
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
    }
    
    // Handle tool selection
    function selectActiveTool(tool) {
        selectedTool = tool;
        
        // Update UI
        [selectTool, pathTool, lineTool, rectTool, ellipseTool].forEach(btn => {
            btn.classList.remove('active');
        });
        
        switch (tool) {
            case 'select': selectTool.classList.add('active'); break;
            case 'path': pathTool.classList.add('active'); break;
            case 'line': lineTool.classList.add('active'); break;
            case 'rectangle': rectTool.classList.add('active'); break;
            case 'ellipse': ellipseTool.classList.add('active'); break;
        }
        
        // Update cursor
        canvas.className = `cursor-${tool}`;
        
        // Deselect when switching tools
        if (selectedObject) {
            selectedObject.isSelected = false;
            selectedObject = null;
            render();
        }
    }
    
    // Tool button events
    selectTool.addEventListener('click', () => selectActiveTool('select'));
    pathTool.addEventListener('click', () => selectActiveTool('path'));
    lineTool.addEventListener('click', () => selectActiveTool('line'));
    rectTool.addEventListener('click', () => selectActiveTool('rectangle'));
    ellipseTool.addEventListener('click', () => selectActiveTool('ellipse'));
    
    // Keyboard shortcuts for tools
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return; // Skip if typing in input fields
        
        switch (e.key.toLowerCase()) {
            case 'v': selectActiveTool('select'); break;
            case 'p': selectActiveTool('path'); break;
            case 'l': selectActiveTool('line'); break;
            case 'r': selectActiveTool('rectangle'); break;
            case 'e': selectActiveTool('ellipse'); break;
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
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
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
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    
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
    
    // Initialize with path tool selected
    selectActiveTool('path');
});
