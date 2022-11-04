class Cylinder{
    /*
        implements a solid cylinder with top and bottom radii allowed to be different
        orthographic view allowed only, projections and camera views to be incorporated in subsequent versions
    */

    vertexShaderSource = `
        attribute vec4 a_position;
        attribute vec3 a_normal;
        attribute float a_face;

        uniform mat4 u_matrix;
        uniform mat4 u_world;

        varying vec3 v_normal;
        varying float v_face;

        void main() {      
            gl_Position = u_matrix * a_position;            
            v_normal =  mat3(u_world) * a_normal;
            v_face = a_face;
        }
    `

    fragmentShaderSource = `
        precision mediump float;
        
        varying float v_face;
        varying vec3 v_normal;

        uniform vec3 u_reverseLightDirection;
        uniform vec4 u_color;

        uniform int u_pickedFace;
        uniform vec4 u_clickedColor;
    
        void main() {
            int face = int(v_face);

            vec3 color = (face == u_pickedFace) ? vec3(u_clickedColor) : u_color.rgb;

            if (u_pickedFace == 0) {
                gl_FragColor = vec4(color, v_face/255.0);
            } 
            else {
                gl_FragColor = vec4(color, u_color.a);
            }

            vec3 normal = normalize(v_normal);
            vec3 u_reverseLightDirection = normalize(u_reverseLightDirection);
            float light = dot(normal, u_reverseLightDirection);

            gl_FragColor.rgb *= light;
        }
    `

    SURFACE_COLOR = [0.2, 1, 0.2, 1]
    EDGE_COLOR = [0, 0, 0]
    LIGHT_DIRECTION = [-0.5, -0.7, -1]
    FACES = []
    
    constructor(center, axis, topRadius, bottomRadius, height, sectorCount=36, stackCount=1, smooth=true, type='discrete'){
        /*
            top and bottom radius both have to be non zero;
            if one of them is zero call cone constructor;
            if both are then it is not a solid;

            height cannot be zero

            center and axis both need to be instances of Vector3d
        */
        this.canvas = canvas;
        this.gl = gl;

        this.center = center;
        this.axis = axis.normalize();
        this.height = height;
        this.topRadius = topRadius;
        this.bottomRadius = bottomRadius;
        this.sectorCount = sectorCount;
        this.stackCount = stackCount;
        this.smooth = smooth;
        this.type = type;

        this.cone = false;

        if(this.bottomRadius == 0 || this.topRadius == 0){
            this.cone = true;
        }

        this.volume = this.calcVol();
        this.z_max = this.calcZMax();

        [this.indexed, this.indexDataType] = this.checkIfIndexingPossible();
        
        this.translation = new Vector3d(canvas.width / 2, canvas.height / 2, 0);
        this.rotation = new Vector3d(0, 0, 0)
        this.scale = 1;
        this.pickedFace = -1;

        this.faceSelected = false;
        // canvas.onclick = this.canvasClick.bind(this);

        state.center = this.center.add(this.translation);

        this.FACES = []

        this.FACES.push(1);
        if(this.type == 'continuous'){
            for(var i = 1; i <= this.sectorCount + 1; i++){
                this.FACES.push(2);
            }
        }
        else if(this.type == 'discrete'){
            for(var i = 1; i <= this.sectorCount + 1; i++){
                this.FACES.push(i + 1);
            }
        }
        this.FACES.push(this.FACES[this.FACES.length - 1] + 1);
    }

    calcZMax(){
        // diagonal is the longest line possible
        return 1.2 * Math.sqrt(this.height ** 2 + (this.topRadius + this.bottomRadius) ** 2)
    }

    calcVol(){
        return Math.PI * this.height * 
            (this.topRadius ** 2 + this.topRadius * this.bottomRadius + this.bottomRadius ** 2) / 3;
    }

    canvasClick(event){
        // TODO: fix mousemoved event, after down -> move -> up cycle, 
        // click events and mouseup events are fired asynchronously
        // indeterminate which one gets fired before
        // fire canvas click event after mouseup on canvas synthetically

        if(state.mouseMoved){
            console.log("could not click")
            state.mouseMoved = false;
            state.mouseButton = -1;
            return;
        }
        
        if(!this.faceSelected){
            var {x, y} = getEventPos(event);
        
            this.pickedFace = 0;
            this.drawGL(this.gl);

            var pixels = new Uint8Array(4);
            gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

            if(this.FACES.includes(pixels[3])){
                this.pickedFace = pixels[3];
                this.drawGL(this.gl);
            }
            else{
                this.pickedFace = -1;
                this.drawGL(this.gl);
            }
        }
        else{
            this.pickedFace = -1;
            this.drawGL(this.gl);
        }
        this.faceSelected = !this.faceSelected;
    }

    radToDeg(r) {
        return r * 180 / Math.PI;
    }

    addSliders(){
        webglLessonsUI.setupSlider("#x", {value: this.translation.x, slide: updatePosition(0, this), min: 0, max: 200 });
        webglLessonsUI.setupSlider("#y", {value: this.translation.y, slide: updatePosition(1, this), min: 0, max: 200 });
        webglLessonsUI.setupSlider("#z", {value: this.translation.z, slide: updatePosition(2, this), min: 0, max: 200 });
        webglLessonsUI.setupSlider("#angleX", {value: this.radToDeg(this.rotation.x), slide: updateRotation(0, this), max: 360});
        webglLessonsUI.setupSlider("#angleY", {value: this.radToDeg(this.rotation.y), slide: updateRotation(1, this), max: 360});
        webglLessonsUI.setupSlider("#angleZ", {value: this.radToDeg(this.rotation.z), slide: updateRotation(2, this), max: 360});
        webglLessonsUI.setupSlider("#scale", {value: this.scale, slide: updateScale(0, this), min: -5, max: 5, step: 0.01, precision: 2});
        

        function updatePosition(index, obj) {
            return function(event, ui) {
                obj.translation = obj.translation.update(index, ui.value)
                obj.drawGL(obj.gl);
            };
        }

        function updateRotation(index, obj) {
            return function(event, ui) {
                var angleInDegrees = ui.value;
                var angleInRadians = angleInDegrees * Math.PI / 180;

                obj.rotation = obj.rotation.update(index, angleInRadians);
                obj.drawGL(obj.gl);
            };
        }

        function updateScale(index, obj) {
            return function(event, ui) {
                obj.scale = ui.value;
                obj.drawGL(obj.gl);
            };
        }
    }

    draw(){
        this.resizeArraysSmooth();
        this.generateVertices();
        this.generateIndices();

        console.log("VBO");
        this.printVectorBuffer3d(this.vertices);
        console.log(this.vertices.length);

        console.log("\n\n\n normals")
        this.printVectorBuffer3d(this.normals);
        console.log(this.normals.length);

        console.log("\n\n\n IBO")
        this.printVectorBuffer3d(this.indices);
        console.log(this.indices.length);

        this.setupProgram(this.gl)
    }

    setupProgram(gl){
        var vertexShader = createShader(gl, gl.VERTEX_SHADER, this.vertexShaderSource);
        var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, this.fragmentShaderSource);

        this.program = createProgram(gl, vertexShader, fragmentShader);

        this.positionLocation = gl.getAttribLocation(this.program, "a_position");
        this.normalLocation= gl.getAttribLocation(this.program, "a_normal");
        this.faceLocation = gl.getAttribLocation(this.program, 'a_face');

        this.matrixLocation = gl.getUniformLocation(this.program, 'u_matrix');
        this.worldMatrixLocation = gl.getUniformLocation(this.program, 'u_world');
        this.reverseLightDirectionLocation = gl.getUniformLocation(this.program, 'u_reverseLightDirection');
        this.colorLocation = gl.getUniformLocation(this.program, 'u_color');
        this.pickedFaceLocation = gl.getUniformLocation(this.program, 'u_pickedFace');
        this.clickedColorLocation = gl.getUniformLocation(this.program, 'u_clickedColor');


        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);

        this.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.STATIC_DRAW);

        this.faceBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.faceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.faces, gl.STATIC_DRAW);

        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

        this.drawGL(gl);
    }

    drawGL(gl){
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        resizeCanvasToDisplaySize();

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.useProgram(this.program);

        gl.enableVertexAttribArray(this.positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        var size = 3;
        var type = gl.FLOAT;
        var normalize = false;
        var stride = 0;
        var offset = 0;
        gl.vertexAttribPointer(
            this.positionLocation, size, type, normalize, stride, offset
        );

        gl.enableVertexAttribArray(this.normalLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        var size = 3;
        var type = gl.FLOAT;
        var normalize = true;
        var stride = 0;
        var offset = 0;
        gl.vertexAttribPointer(
            this.normalLocation, size, type, normalize, stride, offset
        );

        gl.enableVertexAttribArray(this.faceLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.faceBuffer);
        var size = 1;
        var type = gl.FLOAT;
        var normalize = true;
        var stride = 0;
        var offset = 0;
        gl.vertexAttribPointer(
            this.faceLocation, size, type, normalize, stride, offset
        );

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);


        var matrix = m4.projection(gl.canvas.width, gl.canvas.height, this.z_max);
        matrix = m4.translate(matrix, this.translation);
        matrix = m4.rotate(matrix, this.rotation);
        matrix = m4.scale(matrix, this.scale);

        gl.uniformMatrix4fv(this.matrixLocation, false, matrix);
        gl.uniformMatrix4fv(this.worldMatrixLocation, false, m4.inverse(m4.transpose(matrix)));

        gl.uniform4fv(this.colorLocation, this.SURFACE_COLOR);
        gl.uniform3fv(this.reverseLightDirectionLocation, this.LIGHT_DIRECTION);
        gl.uniform1i(this.pickedFaceLocation, this.pickedFace);
        gl.uniform4fv(this.clickedColorLocation, [1.0, 0, 0, 1]);

        var primitiveType = gl.TRIANGLES;
        var offset = 0;
        var count = this.indices.length;
        var indexType = this.indexDataType;
        gl.drawElements(primitiveType, count, indexType, offset);

        // gl.uniform4fv(this.colorLocation, this.EDGE_COLOR)

        // var primitiveType = gl.LINES;
        // var offset = 0;
        // var count = this.indices.length;
        // var indexType = this.indexDataType;
        // gl.drawElements(primitiveType, count, indexType, offset);
    }

    printVectorBuffer3d(buffer){
        var i = 0;
        while(i < buffer.length){
            console.log(buffer[i], buffer[i+1], buffer[i+2]);
            i += 3;
        }
    }

    checkIfIndexingPossible(){
        this.verticesCount = (this.sectorCount + 1) * (this.stackCount + 3);

        if(this.verticesCount <= 2 ** 8){
            return [true, this.gl.UNSIGNED_BYTE];
        }
        else if(this.verticesCount <= 2 ** 16){
            return [true, this.gl.UNSIGNED_SHORT];
        }
        else{
            // check if OES_element_index_uint extension is available
            if(this.gl.getExtension('OES_element_index_uint') && this.verticesCount <= 2 ** 32){
                return [true, this.gl.UNSIGNED_INT];
            }
            else{
                return [false, null];
            }
        }
    }

    clearArrays(){
        this.vertices.length = 0;
        this.normals.length = 0;
        this.indices.length = 0;
        this.faces.length = 0;
    }

    resizeArraysSmooth(){
        var sideCount = (this.sectorCount + 1) * (this.stackCount + 1);
        var baseCount = (this.cone ? 1 : 2) * this.sectorCount + 2;
        var triangleCount = 2 * 3 * this.sectorCount * (this.stackCount + (this.cone ? 0 : 1));

        if(this.smooth){
            this.vertices = new Float32Array(3 * (sideCount + baseCount));
            this.normals = new Float32Array(3 * (sideCount + baseCount));
            this.faces = new Float32Array((sideCount + baseCount));
        }
        else{
            /* 
                each vertex on the side surface is counted twice to account for the
                two normals corresponding to the two surfaces it is part of
            */
            sideCount = 2 * sideCount;
            this.vertices = new Float32Array(3 * (sideCount + baseCount));
            this.normals = new Float32Array(3 * (sideCount + baseCount));
            this.faces = new Float32Array((sideCount + baseCount));
        }

        switch(this.indexDataType){
            case this.gl.UNSIGNED_BYTE: 
                this.indices = new Uint8Array(triangleCount);
                break;
            case this.gl.UNSIGNED_SHORT:
                this.indices = new Uint16Array(triangleCount);
                break;
            case this.gl.UNSIGNED_INT:
                this.indices = new Uint32Array(triangleCount);
                break;
        }
    }

    generateVertices(){
        /*
            generate vertices for top and bottom circumference
            and for each stack building up the side of the cylinder
        */
        var topCenter = this.center.add(this.axis.multiply(this.height * 0.5));
        var bottomCenter = this.center.subtract(this.axis.multiply(this.height * 0.5));

        // generate circumferential point vectors for top and bottom surface
        var [_, i_cap, j_cap] = this.axis.completeBasis();


        const {edgeNormals, faceNormals} = this.computeNormals(i_cap, j_cap, this.axis);
        const normals = this.smooth ? edgeNormals : faceNormals;

        if(this.topRadius != 0){
            var topCircumference = Array(this.sectorCount + 1).fill().map((_, index) => {
                let theta = 2 * Math.PI / this.sectorCount * index;
                let radialVectorI = i_cap.multiply(FloatMath.cos(theta));
                let radialVectorJ = j_cap.multiply(FloatMath.sin(theta));
                let radialVector = radialVectorI.add(radialVectorJ).multiply(this.topRadius);
    
                return topCenter.add(radialVector);
            });
        }
        else{
            topCircumference = Array(this.sectorCount + 1).fill(topCenter);
        }

        if(this.bottomRadius != 0){
            var bottomCircumference = Array(this.sectorCount + 1).fill().map((_, index) => {
                let theta = 2 * Math.PI / this.sectorCount * index;
                let radialVectorI = i_cap.multiply(FloatMath.cos(theta));
                let radialVectorJ = j_cap.multiply(FloatMath.sin(theta));
                let radialVector = radialVectorI.add(radialVectorJ).multiply(this.bottomRadius);
    
                return bottomCenter.add(radialVector);
            });
        }
        else{
            bottomCircumference = Array(this.sectorCount + 1).fill(bottomCenter);
        }

        // add them to vertices array
        var vertexIndex = 0;

        // Part 1: TOP SURFACE
        // Part 1.a: top center
        this.addVertex(vertexIndex, topCenter);
        this.addNormal(vertexIndex, this.axis);
        this.faces[vertexIndex / 3] = 1;
        vertexIndex += 3;

        // Part 1.b: top circumference
        if(this.topRadius != 0){
            for(var radialVector of topCircumference.slice(0, this.sectorCount)){
                this.addVertex(vertexIndex, radialVector);
                this.addNormal(vertexIndex, this.axis);
                this.faces[vertexIndex / 3] = 1;
                vertexIndex += 3;
            }
        }

        // Part 2: BOTTOM SURFACE
        // Part 2.a: bottom center
        this.addVertex(vertexIndex, bottomCenter);
        this.addNormal(vertexIndex, this.axis.multiply(-1));
        this.faces[vertexIndex / 3] = 3;
        vertexIndex += 3;

        // Part 2.b: bottom circumference
        if(this.bottomRadius != 0){
            for(var radialVector of bottomCircumference.slice(0, this.sectorCount)){
                this.addVertex(vertexIndex, radialVector);
                this.addNormal(vertexIndex, this.axis.multiply(-1));
                this.faces[vertexIndex / 3] = 3;
                vertexIndex += 3;
            }
        }

        // Part 3: SIDE SURFACE
        // if stackCount more than 1 interpolate intermediate points
        if(this.stackCount > 1){
            // side surface top stack
            if(this.topRadius == 0){
                // side surface cone top sectors
                let normals = faceNormals;
                for(var j in topCircumference){
                    j = parseInt(j);
                    this.addVertex(vertexIndex, topCircumference[j]);
                    this.addNormal(vertexIndex, normals[j]);
                    this.faces[vertexIndex / 3] = this.FACES[j + 1];
                    vertexIndex += 3;
    
                    if(!this.smooth){
                        // insert the next point with the same normal
                        this.addVertex(vertexIndex, topCircumference[(j + 1) % (this.sectorCount)]);
                        this.addNormal(vertexIndex, normals[j]);
                        this.faces[vertexIndex / 3] = this.FACES[j + 1];
                        vertexIndex += 3;
                    }
                }
            }
            else{
                for(var j in topCircumference){
                    j = parseInt(j);
                    this.addVertex(vertexIndex, topCircumference[j]);
                    this.addNormal(vertexIndex, normals[j]);
                    this.faces[vertexIndex / 3] = this.FACES[j + 1];
                    vertexIndex += 3;
    
                    if(!this.smooth){
                        // insert the next point with the same normal
                        this.addVertex(vertexIndex, topCircumference[(j + 1) % (this.sectorCount)]);
                        this.addNormal(vertexIndex, normals[j]);
                        this.faces[vertexIndex / 3] = this.FACES[j + 1];
                        vertexIndex += 3;
                    }
                }
            }

            // side surface intermediate stack
            // add intermediate points
            for(var level = 1; level <= this.stackCount - 1; level++){
                var interpolatedRadialVectors = Array(topCircumference.length).fill().map((_, j) => {
                    var topRadialVector = topCircumference[j];
                    var bottomRadialVector = bottomCircumference[j];
                    return topRadialVector.multiply(this.stackCount - level).add(
                        bottomRadialVector.multiply(level)
                    ).multiply(1 / this.stackCount);
                });


                for(var j = 0; j < interpolatedRadialVectors.length; j++){
                    j = parseInt(j);
                    this.addVertex(vertexIndex, interpolatedRadialVectors[j]);
                    this.addNormal(vertexIndex, normals[j]);
                    this.faces[vertexIndex / 3] = this.FACES[j + 1];
                    vertexIndex += 3;

                    if(!this.smooth){
                        // insert the next point with the same normal
                        this.addVertex(vertexIndex, interpolatedRadialVectors[(j + 1) % (this.sectorCount)]);
                        this.addNormal(vertexIndex, normals[j]);
                        this.faces[vertexIndex / 3] = this.FACES[j + 1];
                        vertexIndex += 3;
                    }
                }
            }

            // side surface bottom stack
            if(this.bottomRadius == 0){
                // side surface cone bottom sectors
                let normals = faceNormals;
                for(var j in bottomCircumference){
                    j = parseInt(j);
                    this.addVertex(vertexIndex, bottomCircumference[j]);
                    this.addNormal(vertexIndex, normals[j]);
                    this.faces[vertexIndex / 3] = this.FACES[j + 1];
                    vertexIndex += 3;
    
                    if(!this.smooth){
                        // insert the next point with the same normal
                        this.addVertex(vertexIndex, bottomCircumference[(j + 1) % (this.sectorCount)]);
                        this.addNormal(vertexIndex, normals[j]);
                        this.faces[vertexIndex / 3] = this.FACES[j + 1];
                        vertexIndex += 3;
                    }
                }
            }
            else{
                for(var j in bottomCircumference){
                    j = parseInt(j);
                    this.addVertex(vertexIndex, bottomCircumference[j]);
                    this.addNormal(vertexIndex, normals[j]);
                    this.faces[vertexIndex / 3] = this.FACES[j + 1];
                    vertexIndex += 3;
    
                    if(!this.smooth){
                        // insert the next point with the same normal
                        this.addVertex(vertexIndex, bottomCircumference[(j + 1) % (this.sectorCount)]);
                        this.addNormal(vertexIndex, normals[j]);
                        this.faces[vertexIndex / 3] = this.FACES[j + 1];
                        vertexIndex += 3;
                    }
                }
            }
        }
    }   

    generateIndices(){
        /*
            generate indices in locally counter clockwise fashion so that hind faces are hidden behind
        */
        var topCenterIndex = 0;
        var bottomCenterIndex = ((this.topRadius == 0 ? 0 : 1) * this.sectorCount + 1);
        var sideIndexStart = (this.cone ? 1 : 2) * this.sectorCount + 2;
        var shiftFactor = this.smooth ? 1 : 2;
        var triangleIndex = 0;

        var topLevel = 0, bottomLevel = this.stackCount - 1;

        // indices for top circle or for top stack if cone (topRadius == 0)
        if(this.topRadius != 0){
            for(var i = 1; i <= this.sectorCount; i++){
                if(i == this.sectorCount){
                    this.addIndices(triangleIndex, [topCenterIndex, topCenterIndex + i, topCenterIndex + 1]);
                }
                else{
                    this.addIndices(triangleIndex, [topCenterIndex, topCenterIndex + i, topCenterIndex + i + 1]);
                }
                triangleIndex += 3;
            }
        }
        else{

        }

        // indices for base circle
        if(this.bottomRadius != 0){
            for(var i = 1; i <= this.sectorCount; i++){
                if(i == this.sectorCount){
                    this.addIndices(triangleIndex, [bottomCenterIndex, bottomCenterIndex + 1, bottomCenterIndex + i]);
                }
                else{
                    this.addIndices(triangleIndex, [bottomCenterIndex, bottomCenterIndex + i + 1, bottomCenterIndex + i]);
                }
                triangleIndex += 3;
            }
        }

        // indices for side
        for(var level = topLevel; level <= bottomLevel; level++){
            for(var i = 1; i <= this.sectorCount; i++){
                if(level == topLevel && this.topRadius == 0){
                    var sectorIndices = [
                        sideIndexStart + shiftFactor * level * (this.sectorCount + 1) + shiftFactor * (i - 1),
                        sideIndexStart + shiftFactor * (level + 1) * (this.sectorCount + 1) + shiftFactor * (i - 1), 
                        sideIndexStart + shiftFactor * (level + 1) * (this.sectorCount + 1) + shiftFactor * (i - 1) + 1
                    ]
                    this.addIndices(triangleIndex, [sectorIndices[0], sectorIndices[1], sectorIndices[2]]);
                    triangleIndex += 3;
                    continue;
                }
                if(level == bottomLevel && this.bottomRadius == 0){
                    var sectorIndices = [
                        sideIndexStart + shiftFactor * level * (this.sectorCount + 1) + shiftFactor * (i - 1), 
                        sideIndexStart + shiftFactor * level * (this.sectorCount + 1) + shiftFactor * (i - 1) + 1,
                        sideIndexStart + shiftFactor * (level + 1) * (this.sectorCount + 1) + shiftFactor * (i - 1)
                    ]
                    this.addIndices(triangleIndex, [sectorIndices[0], sectorIndices[2], sectorIndices[1]]);
                    triangleIndex += 3;
                    continue;
                }

                var sectorIndices = [
                    sideIndexStart + shiftFactor * level * (this.sectorCount + 1) + shiftFactor * (i - 1), 
                    sideIndexStart + shiftFactor * level * (this.sectorCount + 1) + shiftFactor * (i - 1) + 1,
                    sideIndexStart + shiftFactor * (level + 1) * (this.sectorCount + 1) + shiftFactor * (i - 1), 
                    sideIndexStart + shiftFactor * (level + 1) * (this.sectorCount + 1) + shiftFactor * (i - 1) + 1
                ]
                this.addIndices(triangleIndex, [sectorIndices[0], sectorIndices[3], sectorIndices[1]]);
                triangleIndex += 3;
                this.addIndices(triangleIndex, [sectorIndices[0], sectorIndices[2], sectorIndices[3]]);
                triangleIndex += 3;
            }
        }
    }
    
    computeNormals(i_cap, j_cap, k_cap){
        var z_angle = Math.atan2(this.bottomRadius - this.topRadius, this.height);

        var faceNormals = Array(this.sectorCount + 1).fill().map((_, index) => {
            let theta = 2 * Math.PI / this.sectorCount * (index + 0.5);
            let normalVectorI = i_cap.multiply(FloatMath.cos(theta));
            let normalVectorJ = j_cap.multiply(FloatMath.sin(theta));
            let normalVectorK = k_cap.multiply(FloatMath.sin(z_angle));

            return normalVectorI.add(normalVectorJ.add(normalVectorK));
        })

        var edgeNormals = Array(this.sectorCount + 1).fill().map((_, index) => {
            let theta = 2 * Math.PI / this.sectorCount * index;
            let normalVectorI = i_cap.multiply(FloatMath.cos(theta));
            let normalVectorJ = j_cap.multiply(FloatMath.sin(theta));
            let normalVectorK = k_cap.multiply(FloatMath.sin(z_angle));

            return normalVectorI.add(normalVectorJ.add(normalVectorK));
        })

        return {
            'edgeNormals': edgeNormals,
            'faceNormals': faceNormals
        };
    }

    addVertex(index, vertex){
        this.vertices[index] = vertex.x;
        this.vertices[index + 1] = vertex.y;
        this.vertices[index + 2] = vertex.z;
    }

    addNormal(index, normal){
        this.normals[index] = normal.x;
        this.normals[index + 1] = normal.y;
        this.normals[index + 2] = normal.z;
    }

    addIndices(index, indices){
        this.indices[index] = indices[0];
        this.indices[index + 1] = indices[1];
        this.indices[index + 2] = indices[2];
    }
}
