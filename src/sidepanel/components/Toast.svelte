<script lang="ts">
  interface Props {
    message: string
    type?: 'success' | 'error' | 'info'
    onClose: () => void
  }

  let { message, type = 'info', onClose }: Props = $props()

  $effect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  })
</script>

<div class="toast" class:success={type === 'success'} class:error={type === 'error'}>
  <span class="message">{message}</span>
  <button class="close-btn" onclick={onClose} title="Dismiss">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </button>
</div>

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #374151;
    color: white;
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.2s ease-out;
  }

  .toast.success {
    background: #059669;
  }

  .toast.error {
    background: #dc2626;
  }

  .message {
    flex: 1;
    font-size: 0.875rem;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    border-radius: 0.25rem;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: white;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
