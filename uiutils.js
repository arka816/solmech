document.addEventListener('contextmenu', event => event.preventDefault());

const canvas = document.querySelector("#canvas");
const gl = canvas.getContext("webgl", {preserveDrawingBuffer: true});

var state = {
    xRotateFactor: 2 * Math.PI / canvas.width,
    yRotateFactor: 2 * Math.PI / canvas.height,
    mouseButton: -1,
    mousePos: null,
    mouseMoved: false,
    center: null,
    controlRadius: Math.min(canvas.clientHeight, canvas.clientWidth) / 2
}


canvas.onmouseup = canvasMouseUp;
canvas.onmousedown = canvasMouseDown;
canvas.onmousemove = canvasMouseMove;
canvas.onmouseout = canvasMouseUp;


function resizeCanvasToDisplaySize() {
    const displayWidth  = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    const needResize = canvas.width  !== displayWidth || canvas.height !== displayHeight;
    
    if (needResize) {
        canvas.width  = displayWidth;
        canvas.height = displayHeight;
    }
}



function getEventPos(event){
    var x = event.clientX,
    y = event.clientY,
    rect = event.target.getBoundingClientRect();
    x = x - rect.left;
    y = rect.bottom - y;

    return {
        x: x,
        y: y
    }
}

function transformObjectMouseMove(currMousePos, button){
    // transforms object coordinates according to cursor movement
    if(button == 1){
        // translation
        cylinder.translation = cylinder.translation.add(
            new Vector3d(
                (currMousePos.x - state.mousePos.x),
                -(currMousePos.y - state.mousePos.y),   // since y is reflected; origin at top-left
                0
            )
        )
        cylinder.drawGL(gl);
    }
    else if(button == 3){
        // rotation
        // TODO: figure out why does not work
        // var newPosVec = new Vector3d(currMousePos.x, currMousePos.y, 0);
        // var r1 = state.mouseVec.subtract(state.center).to3D(state.controlRadius);
        // var r2 = newPosVec.subtract(state.center).to3D(state.controlRadius);

        // var angle = Vector3d.angleInRadians(r1, r2);
        // var rotVec = r1.cross(r2).normalize().multiply(angle);

        // cylinder.rotation = cylinder.rotation.add(rotVec);
        // cylinder.drawGL(gl);

        // state.mouseVec = newPosVec;
        cylinder.rotation = cylinder.rotation.add(
            new Vector3d(
                (currMousePos.x - state.mousePos.x) * state.xRotateFactor,
                -(currMousePos.y - state.mousePos.y) * state.yRotateFactor,   // since y is reflected; origin at top-left
                0
            )
        );
        cylinder.drawGL(gl);
    }
    console.log("mouse moved");
    state.mousePos = currMousePos;
}

function canvasMouseMove(event){
    event = event || window.event;
    event.preventDefault();
    event.stopPropagation();

    if(state.mouseButton == -1){
        // mouse clicked
        return;
    }

    var button = event.which;
    state.mouseMoved = true;

    if(state.mouseButton == button){
        switch(button){
            case 1: setCursor('move-canvas'); break;
            case 3: setCursor('rotate-canvas'); break;
            default: setCursor('normal'); break;
        }
        transformObjectMouseMove(getEventPos(event), button)
    }
}

function canvasMouseDown(event){
    event = event || window.event;
    event.preventDefault();
    event.stopPropagation();

    // set key mutex
    // if(state.mouseMoved && state.mouseButton != event.which){
    //     return false;
    // }

    // set  cursor
    switch(event.which){
        case 1: setCursor('move-canvas'); break;
        case 3: setCursor('rotate-canvas'); break;
        default: setCursor('normal'); break;
    }

    state.mouseButton = event.which;
    state.mousePos = getEventPos(event);
    state.mouseVec = new Vector3d(state.mousePos.x, state.mousePos.y, 0);
}

function canvasMouseUp(event){
    event = event || window.event;
    event.preventDefault();
    event.stopPropagation();

    if(event.which == 1){
        // translate movement
        // recompute center of mass
        state.center = cylinder.center.add(cylinder.translation);
        state.center.z = 0;
    }

    // set cursor
    setCursor('normal-canvas');

    state.mouseButton = -1;
    state.mousePos = null;
    state.mouseVec = null;
}


function setCursor(type){
    canvas.classList.remove(...canvas.classList)
    canvas.classList.add(type)
}
