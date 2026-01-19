import { ref, type Ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

export interface Position {
    x: number
    y: number
}

export function useDraggable(
    targetEl: Ref<HTMLElement | null>,
    handleEl: Ref<HTMLElement | null>,
    initialPosition: Position = { x: 0, y: 0 }
) {
    const isDragging = ref(false)
    const position = ref<Position>(initialPosition)
    
    // 贴边状态
    const isStuckToRight = ref(false)
    const isStuckToBottom = ref(false)
    
    // 边缘内边距，确保关闭按钮可见/可点击
    // 8px 是为了让悬浮球不会紧贴着浏览器边缘，留出一点呼吸空间，同时也避免被滚动条遮挡（如果计算有误的话）
    const paddingRight = 8
    const paddingBottom = 8
    const paddingTop = 8
    const paddingLeft = 4 
    
    let startX = 0
    let startY = 0
    let startLeft = 0
    let startTop = 0
    let hasMoved = false

    // 检查是否贴边
    const checkStickiness = () => {
        if (!targetEl.value) return
        
        // 使用 clientWidth/clientHeight 以排除滚动条宽度
        const windowWidth = document.documentElement.clientWidth || window.innerWidth
        const windowHeight = document.documentElement.clientHeight || window.innerHeight
        const elWidth = targetEl.value.offsetWidth
        const elHeight = targetEl.value.offsetHeight
        
        // 贴边判定阈值 (例如 10px)
        // 只要在这个范围内，就认为用户意图是贴边
        const threshold = 10

        // 检查是否贴右边 (考虑 padding)
        if (Math.abs((position.value.x + elWidth) - (windowWidth - paddingRight)) < threshold) {
            isStuckToRight.value = true
        } else {
            isStuckToRight.value = false
        }

        // 检查是否贴底边 (考虑 padding)
        if (Math.abs((position.value.y + elHeight) - (windowHeight - paddingBottom)) < threshold) {
            isStuckToBottom.value = true
        } else {
            isStuckToBottom.value = false
        }
    }

    // 确保在视口内
    const ensureInViewport = () => {
        if (!targetEl.value) return
        
        const windowWidth = document.documentElement.clientWidth || window.innerWidth
        const windowHeight = document.documentElement.clientHeight || window.innerHeight
        const elWidth = targetEl.value.offsetWidth
        const elHeight = targetEl.value.offsetHeight
        
        // 如果元素尚未可见或未测量，跳过
        if (!elWidth || !elHeight) return

        let { x, y } = position.value
        let newX = x
        let newY = y

        // 在限制之前应用贴边偏好
        // 这确保了如果我们之前是贴边的，调整窗口大小时我们会跟随边缘移动
        if (isStuckToRight.value) {
            newX = windowWidth - elWidth - paddingRight
        }
        if (isStuckToBottom.value) {
            newY = windowHeight - elHeight - paddingBottom
        }

        // 标准限制 (如果超出边界则推回)
        // 我们在边缘应用 padding
        if (newX < paddingLeft) newX = paddingLeft
        else if (newX + elWidth > windowWidth - paddingRight) newX = windowWidth - elWidth - paddingRight
        
        if (newY < paddingTop) newY = paddingTop
        else if (newY + elHeight > windowHeight - paddingBottom) newY = windowHeight - elHeight - paddingBottom

        if (newX !== x || newY !== y) {
            position.value = { x: newX, y: newY }
        }
        
        // 调整后更新贴边状态
        // 这确保如果因为 resize 被推到了边缘，它在未来会保持贴边状态
        checkStickiness()
    }

    const handleResize = () => {
        ensureInViewport()
    }

    const handleMouseDown = (e: MouseEvent) => {
        if (!targetEl.value) return
        
        // 忽略交互元素
        const target = e.target as HTMLElement
        if (target.closest('input, select, button, textarea, a')) {
            return
        }
        
        // 阻止默认事件以避免文本选择
        e.preventDefault()
        
        isDragging.value = true
        hasMoved = false
        startX = e.clientX
        startY = e.clientY
        
        // 获取当前位置
        const rect = targetEl.value.getBoundingClientRect()
        startLeft = rect.left
        startTop = rect.top
        
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        
        if (handleEl.value) {
            handleEl.value.style.cursor = 'grabbing'
        }
    }

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.value) return
        
        const deltaX = e.clientX - startX
        const deltaY = e.clientY - startY
        
        // 检查移动阈值以区分点击和拖动
        if (!hasMoved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
            hasMoved = true
        }

        // 计算新位置
        let newLeft = startLeft + deltaX
        let newTop = startTop + deltaY
        
        // 带 padding 的约束
        const windowWidth = document.documentElement.clientWidth || window.innerWidth
        const windowHeight = document.documentElement.clientHeight || window.innerHeight
        const elWidth = targetEl.value?.offsetWidth || 0
        const elHeight = targetEl.value?.offsetHeight || 0
        
        // 简单的边界限制
        if (newLeft < paddingLeft) newLeft = paddingLeft
        if (newLeft + elWidth > windowWidth - paddingRight) newLeft = windowWidth - elWidth - paddingRight
        if (newTop < paddingTop) newTop = paddingTop
        if (newTop + elHeight > windowHeight - paddingBottom) newTop = windowHeight - elHeight - paddingBottom
        
        position.value = {
            x: newLeft,
            y: newTop
        }
    }

    const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        
        if (handleEl.value) {
            handleEl.value.style.cursor = 'grab'
        }

        // 自动吸附逻辑
        if (targetEl.value) {
            const windowWidth = document.documentElement.clientWidth || window.innerWidth
            const windowHeight = document.documentElement.clientHeight || window.innerHeight
            const elWidth = targetEl.value.offsetWidth
            const elHeight = targetEl.value.offsetHeight
            
            // 吸附阈值：当距离边缘小于 20px 时自动吸附
            const snapThreshold = 20
            
            let newX = position.value.x
            let newY = position.value.y
            
            // 右吸附
            if (Math.abs((newX + elWidth) - (windowWidth - paddingRight)) < snapThreshold) {
                newX = windowWidth - elWidth - paddingRight
            }
            // 左吸附
            else if (Math.abs(newX - paddingLeft) < snapThreshold) {
                newX = paddingLeft
            }
            
            // 底吸附
            if (Math.abs((newY + elHeight) - (windowHeight - paddingBottom)) < snapThreshold) {
                newY = windowHeight - elHeight - paddingBottom
            }
            // 顶吸附
            else if (Math.abs(newY - paddingTop) < snapThreshold) {
                newY = paddingTop
            }
            
            position.value = { x: newX, y: newY }
        }

        // 拖动结束后更新贴边状态
        checkStickiness()

        // 如果移动了，延迟重置 isDragging 以阻止后续的 click 事件
        if (hasMoved) {
            setTimeout(() => {
                isDragging.value = false
            }, 0)
        } else {
            isDragging.value = false
        }
    }

    const attach = () => {
        if (handleEl.value) {
            handleEl.value.addEventListener('mousedown', handleMouseDown)
            handleEl.value.style.cursor = 'grab'
        }
    }

    const detach = () => {
        if (handleEl.value) {
            handleEl.value.removeEventListener('mousedown', handleMouseDown)
        }
    }

    watch(handleEl, (newVal, oldVal) => {
        if (oldVal) detach()
        if (newVal) attach()
    })

    // 确保元素出现或改变时位置有效
    let resizeObserver: ResizeObserver | null = null
    
    const cleanupObserver = () => {
        if (resizeObserver) {
            resizeObserver.disconnect()
            resizeObserver = null
        }
    }

    watch(targetEl, (el) => {
        cleanupObserver()
        if (el) {
            resizeObserver = new ResizeObserver(() => {
                ensureInViewport()
            })
            resizeObserver.observe(el)
            nextTick(ensureInViewport)
        }
    }, { immediate: true })

    // 确保如果位置被手动更新（例如从存储），位置是有效的
    // 但避免与拖动冲突
    watch(position, (newPos) => {
        if (!isDragging.value) {
            // 目前无操作，保留结构以防需要
        }
    })

    onMounted(() => {
        attach()
        window.addEventListener('resize', handleResize)
        // 初始检查
        nextTick(ensureInViewport)
    })

    onUnmounted(() => {
        detach()
        cleanupObserver()
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        window.removeEventListener('resize', handleResize)
    })

    return {
        isDragging,
        position,
        ensureInViewport // 如果需要可以导出，但内部使用大多足够
    }
}
