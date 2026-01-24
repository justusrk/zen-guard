<script lang="ts">
  import Toast from './Toast.svelte'

  export interface ToastMessage {
    id: string
    message: string
    type: 'success' | 'error' | 'info'
  }

  interface Props {
    toasts: ToastMessage[]
    onRemove: (id: string) => void
  }

  let { toasts, onRemove }: Props = $props()
</script>

<div class="toast-container">
  {#each toasts as toast (toast.id)}
    <Toast
      message={toast.message}
      type={toast.type}
      onClose={() => onRemove(toast.id)}
    />
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: calc(100% - 2rem);
  }
</style>
