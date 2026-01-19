<template>
  <div class="hidden">
    <h1>作者：youhei</h1>
    <p>用于自动注入编辑器/识别编辑器</p>
    <p>感谢您对本软件的支持！</p>
  </div>
</template>

<script setup lang="ts">
import { Detector } from './editorInjector'; 

// 启动注入监听
Detector.startListening();

</script>

