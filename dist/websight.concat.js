"use strict"

const degToRad = x => x * Math.PI / 180

window.addEventListener("load", () => {
    // Renderer and VR stuff
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)
    renderer.domElement.style.backgroundColor = "black"

    let effect = new THREE.VREffect(renderer)
    effect.separation = 0
    effect.setSize(window.innerWidth, window.innerHeight)

    let vrDisplay

    if (navigator.getVRDisplays) {
        navigator.getVRDisplays().then(displays => displays.length && (vrDisplay = displays[0]))
    }

    // Button to enable VR mode
    enterVRButton.addEventListener("click", () => {
        const controls = document.getElementById("controls")

        if (enterVRButton.classList.contains("small")) {
            closeVR()
            enterVRButton.classList.remove("small")
            controls.classList.remove("hidden")
        } else {
            if (navigator.userAgent.includes("Mobile VR")) {
                vrDisplay.requestPresent([{ source: renderer.domElement }])
            } else {
                effect = new THREE.StereoEffect(renderer)
                effect.separation = 0
                effect.setSize(window.innerWidth, window.innerHeight)
            }

            // Shrink VR button
            enterVRButton.classList.add("small")

            // Hide controls
            controls.classList.add("hidden")
        }
    })

    const closeVR = () => {
        effect = new THREE.VREffect(renderer)
        effect.separation = 0
        effect.setSize(window.innerWidth, window.innerHeight)
    }

    // Scenes and camera
    const fov = 70
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 1, 1000)
    scene.add(camera)

    // Box object
    let texture
    let boxMaterial
    let box

    const makeBoxObject = () => {
        window.video = document.createElement("video")
        video.autoplay = true
        video.width = window.innerWidth / 2
        video.height = window.innerHeight / 2
        getVideoFeed()

        const boxWidth = video.width
        const boxHeight = video.height

        const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, 1)
        texture = new THREE.Texture(video)
        texture.minFilter = THREE.NearestFilter

        boxMaterial = new THREE.ShaderMaterial({
            uniforms: {
                texture: {
                    type: "t",
                    value: texture
                },
                width: {
                    type: "f",
                    value: video.width
                },
                height: {
                    type: "f",
                    value: video.height
                },
                radius: {
                    type: "f",
                    value: 0.4
                },
                intensity: {
                    type: "f",
                    value: 1.0
                },
                edgeR: {
                    type: "f",
                    value: 1.0
                },
                edgeG: {
                    type: "f",
                    value: 1.0
                },
                edgeB: {
                    type: "f",
                    value: 1.0
                },
                surfaceR: {
                    type: "f",
                    value: 0.0
                },
                surfaceG: {
                    type: "f",
                    value: 0.0
                },
                surfaceB: {
                    type: "f",
                    value: 0.0
                }
            },
            vertexShader: vertexShaderSource.text,
            fragmentShader: Filters.compileShader("sobel3x3")
        })

        box = new THREE.Mesh(boxGeometry, boxMaterial)
        scene.add(box)

        camera.position.z = 0.5 * boxWidth * Math.atan(degToRad(90 - fov / 2)) + 100
    }

    let getVideoFeedAttempts = 0

    const getVideoFeed = () => {
        try {
            const mediaDevicesSupport = navigator.mediaDevices && navigator.mediaDevices.getUserMedia

            if (mediaDevicesSupport) {
                navigator.mediaDevices
                    .getUserMedia({ video: { facingMode: "environment" } })
                    .then(stream => {
                        video.src = window.URL.createObjectURL(stream)
                    })
                    .catch(err => {
                        console.log(err)
                        getVideoFeedAttempts++

                        // Rarely, getting the camera fails. Re-attempting usually works, on refresh.
                        if (getVideoFeedAttempts<3) {
                            getVideoFeed()
                        } else {
                            alert("There was an error accessing the camera. Please try again and ensure you are using https")
                        }
                    })
            } else {
                const getUserMedia =
                    navigator.getUserMedia ||
                    navigator.webkitGetUserMedia ||
                    navigator.mozGetUserMedia ||
                    navigator.msGetUserMedia

                if (getUserMedia) {
                    getUserMedia(
                        { video: { facingMode: "environment" } },
                        stream => {
                            video.src = window.URL.createObjectURL(stream)
                        },
                        err => {
                            console.log(err)
                            alert("There was an error accessing the camera. Please try again and ensure you are using https.")
                        }
                    )
                } else {
                    alert("Camera not available")
                }
            }
        } catch (e) {
            alert("Error getting camera feed. Please ensure you are using https.")
        }
    }

    makeBoxObject()

    // Render loop
    const render = () => {
        requestAnimationFrame(render)

        if (video.currentTime) {
            texture.needsUpdate = true
        }

        effect.render(scene, camera)
    }
    render()

    // Request fullscreen when tapped
    if (!window.location.href.includes("localhost")) {
        renderer.domElement.addEventListener("click", () => {
            document.fullscreenEnabled && renderer.domElement.requestFullScreen() ||
            document.webkitFullscreenEnabled && renderer.domElement.webkitRequestFullScreen() ||
            document.mozFullScreenEnabled && renderer.domElement.mozRequestFullScreen() ||
            document.msFullScreenEnabled && renderer.domElement.msRequestFullScreen()
        })
    }

    // Resizing
    window.addEventListener("resize", () => {
        effect.setSize(window.innerWidth, window.innerHeight)
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        scene.remove(box)
        video.pause()
        makeBoxObject()

        setShader(document.querySelector(".filter-button:disabled").dataset.filter)
        setIntensity((parseFloat(document.getElementById("intensitySlider").value)||0.01) / 100)
        setRadius(parseFloat(document.getElementById("radiusSlider").value) / 100)
    })

    window.setShader = shader => {
        Filters.shader = shader
        boxMaterial.fragmentShader = Filters.compileShader(shader)
        boxMaterial.needsUpdate = true
    }

    window.setRadius = val => {
        boxMaterial.uniforms.radius.value = val
    }

    window.setIntensity = val => {
        boxMaterial.uniforms.intensity.value = 1 - val
    }

    window.toggleInverted = () => {
        Filters.isInverted = !Filters.isInverted
        boxMaterial.fragmentShader = Filters.compileShader(Filters.shader)
        boxMaterial.needsUpdate = true
    }

    window.setEdgeColour = ({r=0, g=0, b=0}) => {
        boxMaterial.uniforms.edgeR.value = r / 255
        boxMaterial.uniforms.edgeG.value = g / 255
        boxMaterial.uniforms.edgeB.value = b / 255
    }

    // For reverting to, when toggling back to colour, from background
    const surfaceCache = {}

    window.setSurfaceColour = ({r=0, g=0, b=0}) => {
        boxMaterial.uniforms.surfaceR.value = surfaceCache.r = r / 255
        boxMaterial.uniforms.surfaceG.value = surfaceCache.g = g / 255
        boxMaterial.uniforms.surfaceB.value = surfaceCache.b = b / 255
    }

    window.toggleReducedColours = () => {
        Filters.hasReducedColours = !Filters.hasReducedColours
        boxMaterial.fragmentShader = Filters.compileShader(Filters.shader)
        boxMaterial.needsUpdate = true
    }

    window.toggleBackground = isBackground => {
        Filters.hasBackground = !!isBackground

        if (Filters.hasBackground) {
            boxMaterial.uniforms.surfaceR.value = 0
            boxMaterial.uniforms.surfaceG.value = 0
            boxMaterial.uniforms.surfaceB.value = 0
        } else {
            boxMaterial.uniforms.surfaceR.value = surfaceCache.r
            boxMaterial.uniforms.surfaceG.value = surfaceCache.g
            boxMaterial.uniforms.surfaceB.value = surfaceCache.b
        }

        boxMaterial.fragmentShader = Filters.compileShader(Filters.shader)
        boxMaterial.needsUpdate = true
    }

})

"use strict"

class Filters {

    static get availableFilters () {
        return ["No effect", "Sobel 3x3", "Sobel 5x5", "Frei-Chen"]
    }

    static compileShader (name) {
        return `
            uniform sampler2D texture;
            uniform float width;
            uniform float height;
            uniform float radius;
            uniform float intensity;
            uniform vec2 resolution;
            varying vec2 vUv;

            uniform float edgeR;
            uniform float edgeG;
            uniform float edgeB;

            uniform float surfaceR;
            uniform float surfaceG;
            uniform float surfaceB;

            void main() {

                float w = 1.0 / width;
                float h = 1.0 / height;

                vec4 pixel = texture2D(texture, vUv);

                if (sqrt( (0.5 - vUv[0])*(0.5 - vUv[0]) + (0.5 - vUv[1])*(0.5 - vUv[1]) ) < radius) {

                    ${this[name+"Body"]}

                    gl_FragColor = newColour*(1.0-intensity) + pixel*intensity;

                    ${this.hasBackground ? this.addBackground : ""}

                    ${this.hasReducedColours ? this.reducedColoursBody : ""}

                    ${this.isInverted ? this.invertedBody : ""}

                } else {
                    gl_FragColor = vec4(pixel.rgb, 1.0);
                }

            }
        `
    }

    static get noeffectBody () {
        return `vec4 newColour = vec4(pixel.rgb, 1.0);`
    }

    static get invertedBody () {
        return `
            gl_FragColor.rgb = 1.0 - gl_FragColor.rgb;
        `
    }

    static get reducedColoursBody () {
        return `
            gl_FragColor.r = float(floor(gl_FragColor.r * 5.0 ) / 5.0);
            gl_FragColor.g = float(floor(gl_FragColor.g * 5.0 ) / 5.0);
            gl_FragColor.b = float(floor(gl_FragColor.b * 5.0 ) / 5.0);
        `
    }

    static get addBackground () {
        return `
            gl_FragColor.r += pixel.r * 0.9;
            gl_FragColor.g += pixel.g * 0.9;
            gl_FragColor.b += pixel.b * 0.9;
        `
    }

    /*
    1   0   -1
    2   0   -2
    1   0   -1
    */
    static get sobel3x3Body () {
        return `
            vec4 n[9];

            for (int i=-1; i<=1; i++) {
                for (int j=-1; j<=1; j++) {
                    n[(j+1)+(i+1)*3] = texture2D(texture, vUv + vec2(float(j)*w, float(i)*h) );
                }
            }

            vec4 sobel_x = n[2] + (2.0*n[5]) + n[8] - (n[0] + (2.0*n[3]) + n[6]);
            vec4 sobel_y = n[0] + (2.0*n[1]) + n[2] - (n[6] + (2.0*n[7]) + n[8]);

            float avg_x = (sobel_x.r + sobel_x.g + sobel_x.b) / 3.0;
            float avg_y = (sobel_y.r + sobel_y.g + sobel_y.b) / 3.0;

            sobel_x.r = avg_x;
            sobel_x.g = avg_x;
            sobel_x.b = avg_x;
            sobel_y.r = avg_y;
            sobel_y.g = avg_y;
            sobel_y.b = avg_y;

            vec3 sobel = vec3(sqrt((sobel_x.rgb * sobel_x.rgb) + (sobel_y.rgb * sobel_y.rgb)));
            sobel.r = surfaceR * (1.0 - sobel.r) + sobel.r * edgeR;
            sobel.g = surfaceG * (1.0 - sobel.g) + sobel.g * edgeG;
            sobel.b = surfaceB * (1.0 - sobel.b) + sobel.b * edgeB;

            vec4 newColour = vec4( sobel, 1.0 );
        `
    }

    /*
    2   1   0   -1  -2
    3   2   0   -2  -3
    4   3   0   -3  -4
    3   2   0   -2  -3
    2   1   0   -1  -2
    */
    static get sobel5x5Body () {
        return `
            vec4 n[25];

            for (int i=-2; i<=2; i++) {
                for (int j=-2; j<=2; j++) {
                    n[(j+2)+(i+2)*5] = texture2D(texture, vUv + vec2(float(j)*w, float(i)*h) );
                }
            }

            vec4 sobel_x = 2.0*n[4] + 3.0*n[9] + 4.0*n[14] + 3.0*n[19] + 2.0*n[24] +
                           n[3] + 2.0*n[8] + 3.0*n[13] + 2.0*n[18] + n[23] -
                           (2.0*n[0] + 3.0*n[5] + 4.0*n[10] + 3.0*n[15] + 2.0*n[20] +
                           n[1] + 2.0*n[6] + 3.0*n[11] + 2.0*n[16] + n[21]);

            vec4 sobel_y = 2.0*n[0] + n[1] + n[3] + n[4] +
                           3.0*n[5] + 2.0*n[6] + 2.0*n[8] + 3.0*n[9] -
                           (3.0*n[15] + 2.0*n[16] + 2.0*n[18] + 3.0*n[19] +
                            2.0*n[20] + n[21] + n[23] + n[24]);

            float avg_x = (sobel_x.r + sobel_x.g + sobel_x.b) / 3.0 / 9.0;
            float avg_y = (sobel_y.r + sobel_y.g + sobel_y.b) / 3.0 / 9.0;

            sobel_x.r = avg_x;
            sobel_x.g = avg_x;
            sobel_x.b = avg_x;
            sobel_y.r = avg_y;
            sobel_y.g = avg_y;
            sobel_y.b = avg_y;

            vec3 sobel = vec3(sqrt((sobel_x.rgb * sobel_x.rgb) + (sobel_y.rgb * sobel_y.rgb)));
            sobel.r = surfaceR * (1.0 - sobel.r) + sobel.r * edgeR;
            sobel.g = surfaceG * (1.0 - sobel.g) + sobel.g * edgeG;
            sobel.b = surfaceB * (1.0 - sobel.b) + sobel.b * edgeB;

            vec4 newColour = vec4(sobel, 1.0 );
        `
    }

    static get freichenBody () {
        return `

            vec2 texel = vec2(1.0 / width, 1.0 / height);
            mat3 I;
            mat3 G[9];
            float cnv[9];

            G[0] = mat3( 0.3535533845424652, 0, -0.3535533845424652, 0.5, 0, -0.5, 0.3535533845424652, 0, -0.3535533845424652 );
            G[1] = mat3( 0.3535533845424652, 0.5, 0.3535533845424652, 0, 0, 0, -0.3535533845424652, -0.5, -0.3535533845424652 );
            G[2] = mat3( 0, 0.3535533845424652, -0.5, -0.3535533845424652, 0, 0.3535533845424652, 0.5, -0.3535533845424652, 0 );
            G[3] = mat3( 0.5, -0.3535533845424652, 0, -0.3535533845424652, 0, 0.3535533845424652, 0, 0.3535533845424652, -0.5 );
            G[4] = mat3( 0, -0.5, 0, 0.5, 0, 0.5, 0, -0.5, 0 );
            G[5] = mat3( -0.5, 0, 0.5, 0, 0, 0, 0.5, 0, -0.5 );
            G[6] = mat3( 0.1666666716337204, -0.3333333432674408, 0.1666666716337204, -0.3333333432674408, 0.6666666865348816, -0.3333333432674408, 0.1666666716337204, -0.3333333432674408, 0.1666666716337204 );
            G[7] = mat3( -0.3333333432674408, 0.1666666716337204, -0.3333333432674408, 0.1666666716337204, 0.6666666865348816, 0.1666666716337204, -0.3333333432674408, 0.1666666716337204, -0.3333333432674408 );
            G[8] = mat3( 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408 );

            // Get intensity
            I[0][0] = length(texture2D(texture, vUv + texel * vec2(-1.0,-1.0) ).rgb);
            I[0][1] = length(texture2D(texture, vUv + texel * vec2(-1.0,0.0) ).rgb);
            I[0][2] = length(texture2D(texture, vUv + texel * vec2(-1.0,1.0) ).rgb);
            I[1][0] = length(texture2D(texture, vUv + texel * vec2(0.0,-1.0) ).rgb);
            I[1][1] = length(texture2D(texture, vUv + texel * vec2(0.0,0.0) ).rgb);
            I[1][2] = length(texture2D(texture, vUv + texel * vec2(0.0,1.0) ).rgb);
            I[2][0] = length(texture2D(texture, vUv + texel * vec2(1.0,-1.0) ).rgb);
            I[2][1] = length(texture2D(texture, vUv + texel * vec2(1.0,0.0) ).rgb);
            I[2][2] = length(texture2D(texture, vUv + texel * vec2(1.0,1.0) ).rgb);

            // Convolve
            cnv[0] = pow(dot(G[0][0], I[0]) + dot(G[0][1], I[1]) + dot(G[0][2], I[2]) , 2.0);
            cnv[1] = pow(dot(G[1][0], I[0]) + dot(G[1][1], I[1]) + dot(G[1][2], I[2]) , 2.0);
            cnv[2] = pow(dot(G[2][0], I[0]) + dot(G[2][1], I[1]) + dot(G[2][2], I[2]) , 2.0);
            cnv[3] = pow(dot(G[3][0], I[0]) + dot(G[3][1], I[1]) + dot(G[3][2], I[2]) , 2.0);
            cnv[4] = pow(dot(G[4][0], I[0]) + dot(G[4][1], I[1]) + dot(G[4][2], I[2]) , 2.0);
            cnv[5] = pow(dot(G[5][0], I[0]) + dot(G[5][1], I[1]) + dot(G[5][2], I[2]) , 2.0);
            cnv[6] = pow(dot(G[6][0], I[0]) + dot(G[6][1], I[1]) + dot(G[6][2], I[2]) , 2.0);
            cnv[7] = pow(dot(G[7][0], I[0]) + dot(G[7][1], I[1]) + dot(G[7][2], I[2]) , 2.0);
            cnv[8] = pow(dot(G[8][0], I[0]) + dot(G[8][1], I[1]) + dot(G[8][2], I[2]) , 2.0);

            float M = (cnv[0] + cnv[1]) + (cnv[2] + cnv[3]);
            float S = (cnv[4] + cnv[5]) + (cnv[6] + cnv[7]) + (cnv[8] + M);

            vec3 freiChen = vec3(sqrt(M/S)) * 2.0;
            freiChen.r = surfaceR * (1.0 - freiChen.r) + freiChen.r * edgeR;
            freiChen.g = surfaceG * (1.0 - freiChen.g) + freiChen.g * edgeG;
            freiChen.b = surfaceB * (1.0 - freiChen.b) + freiChen.b * edgeB;

            vec4 newColour = vec4(freiChen, 1.0 );
        `
    }
}
"use strict"

window.addEventListener("load", () => {

    const filters = Filters.availableFilters
    const initialFilter = window.localStorage.getItem("filter") || "sobel3x3"

    window.setShader(initialFilter)

    const controlsRoot = document.getElementById("controls")
    const filtersRoot = controlsRoot.getElementsByClassName("filters")[0]
    const slidersRoot = controlsRoot.getElementsByClassName("sliders")[0]

    // Create filter buttons
    const filterButtons = filters.map((filter) => {
        const button = document.createElement("button")
        button.dataset.filter = filter.toLowerCase().replace(/\s|\-/g, "")
        button.innerText = filter
        button.classList.add("filter-button")

        if (button.dataset.filter === initialFilter) button.disabled = true

        filtersRoot.appendChild(button)
        return button
    }, [])

    // Radius slider
    const radiusSlider = document.createElement("input")
    radiusSlider.id = "radiusSlider"
    radiusSlider.type = "range"
    radiusSlider.name = "radius"
    radiusSlider.value = parseInt(window.localStorage.getItem("radius")) || 50
    radiusSlider.min = 0
    radiusSlider.max = 100
    radiusSlider.step = 1

    // Radius slider label
    const radiusLabel = document.createElement("label")
    radiusLabel.for = "radius"
    radiusLabel.innerText = "Radius: "

    // Radius slider value
    const radiusValue = document.createElement("span")
    radiusValue.innerText = "50%"

    radiusLabel.appendChild(radiusSlider)
    radiusLabel.appendChild(radiusValue)
    slidersRoot.appendChild(radiusLabel)

    // Intensity slider
    const intensitySlider = document.createElement("input")
    intensitySlider.id = "intensitySlider"
    intensitySlider.type = "range"
    intensitySlider.name = "intensity"
    intensitySlider.value = parseInt(window.localStorage.getItem("intensity")) || 100
    intensitySlider.min = 0
    intensitySlider.max = 100
    intensitySlider.step = 1

    const intensityLabel = document.createElement("label")
    intensityLabel.for = "intensity"
    intensityLabel.innerText = "Intensity: "

    const intensityValue = document.createElement("span")
    intensityValue.innerText = "100%"

    intensityLabel.appendChild(intensitySlider)
    intensityLabel.appendChild(intensityValue)
    slidersRoot.appendChild(intensityLabel)

    // Events
    document.addEventListener("click", ({ target }) => {
        if (target.dataset.filter) {
            window.setShader(target.dataset.filter)
            filterButtons.forEach(button => button.disabled = false)
            target.disabled = true
            window.localStorage.setItem("filter", target.dataset.filter)
        }
    })

    const updateRadius = ({ target }) => {
        window.setRadius(target.value / 100)
        radiusValue.innerText = `${target.value}%`
        window.localStorage.setItem("radius", target.value)
    }
    updateRadius({target: radiusSlider})

    radiusSlider.addEventListener("change", updateRadius)
    radiusSlider.addEventListener("mousemove", updateRadius)

    const updateIntensity = ({ target }) => {
        window.setIntensity(target.value === "0" ? 0.01 : target.value / 100)
        intensityValue.innerText = `${target.value}%`
        window.localStorage.setItem("intensity", target.value)
    }
    updateIntensity({target: intensitySlider})

    intensitySlider.addEventListener("mousemove", updateIntensity)
    intensitySlider.addEventListener("change", updateIntensity)

    const controlMenuToggle = document.querySelector("#controls .toggle")
    controlMenuToggle.addEventListener("click", () => controlsRoot.classList.toggle("open"))


    /* Temp */
    /* ==== */
    invertedCheckbox.addEventListener("click", () => toggleInverted())
    reducedColoursCheckbox.addEventListener("click", () => toggleReducedColours())
    backgroundCheckbox.addEventListener("click", () => toggleBackground(!Filters.hasBackground))

    setBlueEdgesButton.addEventListener("click", () => {setEdgeColour({r: 0, g: 0, b: 255})})
    setGreenEdgesButton.addEventListener("click", () => {setEdgeColour({r: 0, g: 255, b: 0})})

    setRedBackgroundButton.addEventListener("click", () => {
        setSurfaceColour({r: 255, g: 0, b: 0})
        toggleBackground()
    })
    setYellowBackgroundButton.addEventListener("click", () => {
        setSurfaceColour({r: 255, g: 255, b: 0})
        toggleBackground()
    })
    /* ==== */

})

//# sourceMappingURL=websight.concat.js.map