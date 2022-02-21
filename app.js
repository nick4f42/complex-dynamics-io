"use strict";

const { mat2d, vec2 } = glMatrix;

const canvas_gl = document.getElementById('canvas-gl');


const GLSL_COMPLEX = `
#define M_PI 3.14159265358979323846264338327950288

struct Complex {
    float re;
    float im;
};

Complex vec2cplx(vec2 v) { return Complex(v.x, v.y); }

// Convert a complex number to a vec2 of its real and imaginary parts.
vec2 cplx2vec(float z) { return vec2(z, 0.0); }
vec2 cplx2vec(Complex z) { return vec2(z.re, z.im); }

// The real part of a complex number.
float real(float z) { return z; }
float real(Complex z) { return z.re; }

// The imaginary part of a complex number.
float imag(float z) { return 0.0; }
float imag(Complex z) { return z.im; }

// The complex conjugate of a complex number.
float conj(float z) { return z; }
Complex conj(Complex z) { return Complex(z.re, -z.im); }

// The absolute value of a complex number.
float cabs(float z) { return abs(z); }
float cabs(Complex z) { return length(vec2(z.re, z.im)); }

// The distance between two complex numbers.
float cdist(float a, float b) { return abs(a - b); }
float cdist(float a, Complex b) { return distance(cplx2vec(a), cplx2vec(b)); }
float cdist(Complex a, float b) { return distance(cplx2vec(a), cplx2vec(b)); }
float cdist(Complex a, Complex b) { return distance(cplx2vec(a), cplx2vec(b)); }

// The argument of a complex number.
float carg(float z) { return z >= 0.0 ? 0.0 : M_PI; }
float carg(Complex z) { return atan(z.im, z.re); }

// The square absolute value of a complex number.
float cabs2(float z) { return z * z; }
float cabs2(Complex z) { return z.re * z.re + z.im * z.im; }

// Add two complex numbers.
float cadd(float a, float b) { return a + b; }
Complex cadd(float a, Complex b) { return Complex(a + b.re, b.im); }
Complex cadd(Complex a, float b) { return Complex(a.re + b, a.im); }
Complex cadd(Complex a, Complex b) { return Complex(a.re + b.re, a.im + b.im); }

// Subtract two complex numbers.
float csub(float a, float b) { return a - b; }
Complex csub(float a, Complex b) { return Complex(a - b.re, -b.im); }
Complex csub(Complex a, float b) { return Complex(a.re - b, a.im); }
Complex csub(Complex a, Complex b) { return Complex(a.re - b.re, a.im - b.im); }

// Unary minus operator.
float cneg(float z) { return -z; }
Complex cneg(Complex z) { return Complex(-z.re, -z.im); }

// Multiply two complex numbers.
float cmul(float a, float b) { return a * b; }
Complex cmul(float a, Complex b) { return Complex(a * b.re, a * b.im); }
Complex cmul(Complex a, float b) { return Complex(b * a.re, b * a.im); }
Complex cmul(Complex a, Complex b) {
    return Complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
}

// Divide two complex numbers.
float cdiv(float a, float b) { return a / b; }
Complex cdiv(Complex a, float b) { return Complex(a.re / b, a.im / b); }
Complex cdiv(float a, Complex b) { return cdiv(cmul(a, conj(b)), cabs2(b)); }
Complex cdiv(Complex a, Complex b) { return cdiv(cmul(a, conj(b)), cabs2(b)); }

// Calculates cos(t) + i sin(t).
Complex cis(float t) { return Complex(cos(t), sin(t)); }

// The complex exponential of p.
float cexp(float p) { return exp(p); }
Complex cexp(Complex p) { return cmul(exp(p.re), cis(p.im)); }

// The complex logarithm of z.
float clog(float z) { return log(z); }
Complex clog(Complex z) { return Complex(log(cabs(z)), carg(z)); }

// Return z to the complex power of p.
float cpow(float z, float p) { return pow(z, p); }
Complex cpow(float z, Complex p) { return cexp(cmul(p, log(z))); }
Complex cpow(Complex z, float p) {
    return cmul(pow(cabs2(z), 0.5 * p), cis(p * carg(z)));
}
Complex cpow(Complex z, Complex p) { return cexp(cmul(p, clog(z))); }
`;


const vertexSource = `
attribute vec2 Pos;
uniform mat3 ViewMatrix;
varying vec2 Coords;

void main() {
    gl_Position = vec4(Pos, 0.0, 1.0);
    Coords = (ViewMatrix * vec3(Pos, 1.0)).xy;
}
`;


const fragSource = `
precision highp float;

varying vec2 Coords;

${GLSL_COMPLEX}

void main() {
    Complex p = vec2cplx(Coords);
    Complex z = Complex(0.0, 0.0);

    for (int i = 0; i < 100; ++i) {
        z = cadd(cmul(z, z), p);
        if (cabs(z) > 2.0) {
            gl_FragColor = vec4(0.3, 0.3, 0.7, 1.0);
            return;
        }
    }

    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;


function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled) {
        const error = gl.getShaderInfoLog(shader);
        console.error(`Failed to compile ${type} shader: ${error}`);
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}


function createProgram(gl, vertexSource, fragSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragSource);
    if (!vertexShader || !fragmentShader) {
        return null;
    }

    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);

    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
        const error = gl.getProgramInfoLog(program);
        console.error('Failed to link shader program: ' + error);

        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return null;
    }

    return program;
}


function getUniformLocation(gl, program, uniform) {
    const loc = gl.getUniformLocation(program, uniform);
    if (!loc) {
        console.error('Unable to retrieve location of uniform ' + uniform);
    }
    return loc;
}


function initBuffer(gl, program) {
    // Coordinates of a square for the viewing area
    const coords = new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, coords, gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(program, 'Pos');
    if (pos < 0) {
        console.error('Failed to get location of attribute `Pos`.');
        return -1;
    }

    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(pos);

    // Number of coordinates
    return coords.length / 2;
}


class MouseController {

    constructor(damping) {
        this.damping = damping;

        this.viewMatrix = mat2d.create();
        this.viewMatrix[0] = canvas_gl.width / canvas_gl.height;

        this.viewInv = mat2d.invert(mat2d.create(), this.viewMatrix);

        this.dragging = false;
        this.zoomSpeed = 0.2;

        // Position of the last click in complex coords
        this.clickCplx = vec2.create();
        // Position of the mouse in complex coords
        this.mouseCplx = vec2.create();

        // Position and velocity of the mouse in screen coords
        this.mousePos = vec2.create();
        this.mouseVel = vec2.create();

        // Velocity of the view window
        this.cplxVel = vec2.create();

        this.prevMousePos = vec2.create();
        this.prevMouseTime = performance.now();

        this.viewMatrix3D = new Float32Array(9);
        this.viewMatrix3D[8] = 1;

        this.setupEvents();
    }

    update(dt) {
        if (!self.dragging) {
            this.mouseVel[0] -= dt * this.damping * this.mouseVel[0];
            this.mouseVel[1] -= dt * this.damping * this.mouseVel[1];

            vec2.transformMat2(this.cplxVel, this.mouseVel, this.viewMatrix);

            this.viewMatrix[4] -= dt * this.cplxVel[0];
            this.viewMatrix[5] -= dt * this.cplxVel[1];

            mat2d.invert(this.viewInv, this.viewMatrix);
        }
    }

    getViewMatrix3D() {
        const a = this.viewMatrix3D;
        const b = this.viewMatrix;

        a[0] = b[0];
        a[1] = b[1];
        a[3] = b[2];
        a[4] = b[3];
        a[6] = b[4];
        a[7] = b[5];

        return a;
    }

    updateMousePos(evt) {
        vec2.copy(this.prevMousePos, this.mousePos);

        let rect = canvas_gl.getBoundingClientRect();
        this.mousePos[0] = 2 * (evt.clientX - rect.left) / canvas_gl.clientWidth - 1;
        this.mousePos[1] = 1 - 2 * (evt.clientY - rect.top) / canvas_gl.clientHeight;

        vec2.transformMat2d(this.mouseCplx, this.mousePos, this.viewMatrix);

        let time = performance.now();
        let dt = time - this.prevMouseTime;
        this.prevMouseTime = time;
        return dt;
    }

    setupEvents() {
        addEventListener("mousedown", e => {
            this.updateMousePos(e);

            this.dragging = true;
            vec2.copy(this.clickCplx, this.mouseCplx);
        });

        addEventListener("mouseup", _ => {
            this.dragging = false;
        });

        addEventListener("mousemove", e => {
            const dt = Math.max(1e-3, this.updateMousePos(e));

            if (this.dragging) {
                this.mouseVel[0] = (this.mousePos[0] - this.prevMousePos[0]) / dt;
                this.mouseVel[1] = (this.mousePos[1] - this.prevMousePos[1]) / dt;

                this.viewMatrix[4] += this.clickCplx[0] - this.mouseCplx[0];
                this.viewMatrix[5] += this.clickCplx[1] - this.mouseCplx[1];
            }

            mat2d.invert(this.viewInv, this.viewMatrix);
        });

        addEventListener("wheel", e => {
            const zoom = this.zoomSpeed * Math.sign(e.deltaY);
            const zoomMul = 1.0 + zoom;

            this.viewMatrix[3] *= zoomMul;
            this.viewMatrix[0] = this.viewMatrix[3] * canvas_gl.width / canvas_gl.height;

            this.viewMatrix[4] += (this.viewMatrix[4] - this.mouseCplx[0]) * zoom;
            this.viewMatrix[5] += (this.viewMatrix[5] - this.mouseCplx[1]) * zoom;

            mat2d.invert(this.viewInv, this.viewMatrix);
        });

        addEventListener("resize", _ => {
            this.viewMatrix[0] = this.viewMatrix[3] * canvas_gl.width / canvas_gl.height;
            mat2d.invert(this.viewInv, this.viewMatrix);
        });
    }
}


addEventListener('load', () => {
    const gl = canvas_gl.getContext('webgl');
    if (!gl) {
        console.error('Failed to initialize webgl.');
        return;
    }

    // Resize canvas when screen is resized
    function resizeCanvas() {
        canvas_gl.width = innerWidth;
        canvas_gl.height = innerHeight;
        gl.viewport(0, 0, innerWidth, innerHeight);
    }
    addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const program = createProgram(gl, vertexSource, fragSource);
    if (!program) {
        return;
    }
    gl.useProgram(program);

    const bufferLength = initBuffer(gl, program);

    const u_ViewMatrix = getUniformLocation(gl, program, "ViewMatrix");

    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    const mouseControl = new MouseController(0.02);

    let prevTime = performance.now();
    function update() {

        const time = performance.now();
        const dt = time - prevTime;
        prevTime = time;

        gl.clear(gl.COLOR_BUFFER_BIT);

        mouseControl.update(dt);
        gl.uniformMatrix3fv(u_ViewMatrix, false, mouseControl.getViewMatrix3D());
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, bufferLength);

        requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
});
