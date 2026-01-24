<script lang="ts">
  interface Props {
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
    destructive?: boolean
    onConfirm: () => void
    onCancel: () => void
  }

  let {
    title = 'Confirm',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    destructive = false,
    onConfirm,
    onCancel
  }: Props = $props()
</script>

<div class="modal-overlay" onclick={onCancel} role="presentation">
  <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog">
    <h2>{title}</h2>
    <p class="message">{message}</p>
    <div class="actions">
      <button class="cancel-btn" onclick={onCancel}>{cancelText}</button>
      <button class="confirm-btn" class:destructive onclick={onConfirm}>{confirmText}</button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 150;
  }

  .modal {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    width: 90%;
    max-width: 360px;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  h2 {
    margin: 0 0 0.75rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
  }

  .message {
    margin: 0 0 1.5rem;
    font-size: 0.875rem;
    color: #6b7280;
    line-height: 1.5;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .cancel-btn {
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
  }

  .cancel-btn:hover {
    background: #e5e7eb;
  }

  .confirm-btn {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: white;
    cursor: pointer;
  }

  .confirm-btn:hover {
    background: #2563eb;
  }

  .confirm-btn.destructive {
    background: #dc2626;
  }

  .confirm-btn.destructive:hover {
    background: #b91c1c;
  }
</style>
