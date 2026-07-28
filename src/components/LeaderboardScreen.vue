<template>
  <main class="leaderboard-page">
    <div class="leaderboard-header">
      <button class="icon-button" @click="$emit('home')" title="На главную"><ArrowLeft :size="21" /></button>
      <div><p class="eyebrow"><Trophy :size="16" /> Рейтинг</p><h1>Таблица лидеров</h1><p>Рейтинг по среднему баллу всех завершенных симуляций.</p></div>
    </div>
    <section class="leaderboard-table">
      <div class="leaderboard-columns"><span>Место и участник</span><span>Средний результат</span></div>
      <div v-for="(player, index) in players" :key="player.id" class="leaderboard-row" :class="{ current: player.id === currentUser.id }">
        <span class="rank" :class="`rank-${index + 1}`">{{ index + 1 }}</span>
        <span class="player"><i>{{ player.name.slice(0, 1).toUpperCase() }}</i><strong>{{ player.name }}<small v-if="player.id === currentUser.id">Вы</small></strong></span>
        <b>{{ player.averageGrade }}<small> / 100</small></b>
      </div>
      <p v-if="!players.length" class="empty-state">Завершите первый тест, чтобы появиться в рейтинге.</p>
    </section>
    <p class="leaderboard-note"><Info :size="15" /> Средний балл сохраняется в Supabase и не удаляется при очистке истории.</p>
  </main>
</template>

<script setup>
import { ArrowLeft, Info, Trophy } from 'lucide-vue-next'

defineProps({ players: Array, currentUser: Object })
defineEmits(['home'])
</script>

<style scoped>
.leaderboard-columns,
.leaderboard-row {
  grid-template-columns: minmax(250px, 1fr) 150px;
}

@media (max-width: 760px) {
  .leaderboard-row {
    grid-template-columns: 1fr 72px;
  }
}
</style>
