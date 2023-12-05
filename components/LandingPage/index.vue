
import { log } from 'console';
<template>
    <div>
        <UContainer class="flex flex-col">
        Hello this is the landing page!
        <div class="w-[220px] min-h-[45px] pt-10 pb-6 cursor-pointer" @click="onLogoClick">
            <span class="dark:hidden">
            <img src="/logo/manuscrape-logo-dark.svg"  alt="manuscrape logo dark">
            </span>
            <span class="hidden dark:block">
            <img src="/logo/manuscrape-logo-light.svg" alt="manuscrape logo light">
            </span>
        </div>
        </UContainer>
    </div>
</template>

<script setup lang="ts">
    function onLogoClick() {
        console.log('TODO');
    }
</script>