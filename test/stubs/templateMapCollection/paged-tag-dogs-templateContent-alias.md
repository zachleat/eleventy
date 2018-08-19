---
title: Paged Test
pagination:
  data: collections.dog
  size: 2
  alias: dogs
---

Before
{% for dog in dogs %}
{{ dog.templateContent }}
{% endfor %}
After
