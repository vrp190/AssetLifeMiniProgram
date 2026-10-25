Component({
  properties: {
    items: { type: Array, value: [] },      // [{ key, title }]
    current: { type: String, value: '' }
  },
  methods: {
    onTap: function (event) {
      const key = event.currentTarget.dataset.key
      if (key !== this.data.current) {
        this.triggerEvent('change', { key: key })
      }
    }
  }
})
