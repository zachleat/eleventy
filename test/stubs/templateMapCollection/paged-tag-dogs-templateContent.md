---
title: Paged Test
pagination:
  data: collections.dog
  size: 1
---

Before
{% for dog in collections.dog %}
{{ dog.templateContent }}
{% endfor %}
After
