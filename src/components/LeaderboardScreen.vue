<template>
  <main class="leaderboard-page">
    <div class="leaderboard-header">
      <button class="icon-button" @click="$emit('home')" title="На главную"><ArrowLeft :size="21" /></button>
      <div><p class="eyebrow"><Trophy :size="16" /> Рейтинг</p><h1>Таблица лидеров</h1><p>Рейтинг аккаунтов на этом устройстве по лучшему результату симуляции.</p></div>
    </div>
    <section class="leaderboard-table">
      <div class="leaderboard-columns"><span>Место и участник</span><span>Лучший балл</span><span>Точность</span><span>Тесты</span></div>
      <div v-for="(player, index) in players" :key="player.id" class="leaderboard-row" :class="{ current: player.id === currentUser.id }">
        <span class="rank" :class="`rank-${index + 1}`">{{ index + 1 }}</span>
        <span class="player"><i>{{ player.name.slice(0, 1).toUpperCase() }}</i><strong>{{ player.name }}<small v-if="player.id === currentUser.id">Вы</small></strong></span>
        <b>{{ player.bestGrade || '—' }}<small v-if="player.bestGrade"> / 100</small></b>
        <span>{{ player.accuracy }}%</span>
        <span>{{ player.sessions }}</span>
      </div>
      <p v-if="!players.length" class="empty-state">Завершите первый тест, чтобы появиться в рейтинге.</p>
    </section>
    <p class="leaderboard-note"><Info :size="15" /> Данные не отправляются в интернет и доступны только в этом браузере.</p>
  </main>
</template>

<script setup>
import { ArrowLeft, Info, Trophy } from 'lucide-vue-next'

defineProps({ players: Array, currentUser: Object })
defineEmits(['home'])
</script>
